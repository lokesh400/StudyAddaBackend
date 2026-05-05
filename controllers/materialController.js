const axios = require('axios');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const Material = require('../models/Material');
const Activity = require('../models/Activity');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');
const path = require('path');
const fs = require('fs');

const VIEW_TOKEN_TTL_MS = 30 * 60 * 1000;

function buildViewSignature(userId, materialId, exp) {
  const secret = process.env.VIEW_TOKEN_SECRET || process.env.SESSION_SECRET || 'dev-view-token-secret';
  const payload = `${userId}:${materialId}:${exp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

module.exports.listMaterials = async (req, res) => {
  const { q = '', subject = '' } = req.query;
  const user = await req.user.populate('cohort.department cohort.branch cohort.semester');
  const selectedSemester = user.cohort?.semester?._id;

  const materialFilter = {};
  if (q) materialFilter.$text = { $search: q };
  if (subject) materialFilter.subject = subject;
  if (selectedSemester) materialFilter.semester = selectedSemester;

  const materials = await Material.find(materialFilter)
    .populate('subject branch semester')
    .sort({ uploadedAt: -1 });

  const subjects = selectedSemester
    ? await Subject.find({ semester: selectedSemester }).sort({ name: 1 })
    : [];

  const departments = await Department.find().sort({ name: 1 });

  res.render('student/materials', {
    materials,
    subjects,
    departments,
    cohort: user.cohort || {},
    filters: { q, subject }
  });
};

module.exports.setCohort = async (req, res, next) => {
  try {
    const { departmentId, branchId, semesterId } = req.body;

    // Validate required fields
    if (!departmentId || !branchId || !semesterId) {
      req.flash('error', 'Department, branch, and semester are required.');
      return res.redirect('/materials');
    }

    // Verify IDs exist in database
    const [dept, branch, semester] = await Promise.all([
      Department.findById(departmentId),
      Branch.findById(branchId),
      Semester.findById(semesterId)
    ]);

    if (!dept || !branch || !semester) {
      req.flash('error', 'Invalid department, branch, or semester selected.');
      return res.redirect('/materials');
    }

    // Update user cohort
    req.user.cohort = { department: departmentId, branch: branchId, semester: semesterId };
    await req.user.save();
    req.flash('success', 'Cohort updated successfully.');
    res.redirect('/materials');
  } catch (err) {
    next(err);
  }
};

module.exports.browseMaterials = async (req, res) => {
  const { q = '', subject = '' } = req.query;
  const user = await req.user.populate('cohort.department cohort.branch cohort.semester');
  const selectedSemester = user.cohort?.semester?._id;

  const materialFilter = {};
  if (q) materialFilter.$text = { $search: q };
  if (subject) materialFilter.subject = subject;
  if (selectedSemester) materialFilter.semester = selectedSemester;

  const materials = await Material.find(materialFilter)
    .populate('subject branch semester')
    .sort({ uploadedAt: -1 });

  const subjects = selectedSemester
    ? await Subject.find({ semester: selectedSemester }).sort({ name: 1 })
    : [];

  res.render('student/browse', {
    materials,
    subjects,
    cohort: user.cohort || {},
    filters: { q, subject }
  });
};

module.exports.getBranches = async (req, res, next) => {
  try {
    if (!req.params.departmentId) {
      return res.status(400).json({ error: 'Department ID required' });
    }
    const branches = await Branch.find({ department: req.params.departmentId }).sort({ name: 1 });
    res.json(branches);
  } catch (err) {
    next(err);
  }
};

module.exports.getSemesters = async (req, res, next) => {
  try {
    if (!req.params.branchId) {
      return res.status(400).json({ error: 'Branch ID required' });
    }
    const semesters = await Semester.find({ branch: req.params.branchId }).sort({ number: 1 });
    res.json(semesters);
  } catch (err) {
    next(err);
  }
};

module.exports.viewerPage = async (req, res) => {
  const material = await Material.findById(req.params.id).populate('subject branch semester');
  if (!material) {
    req.flash('error', 'Material not found');
    return res.redirect('/materials');
  }

  req.user.recentlyViewed = req.user.recentlyViewed.filter((item) => item.material.toString() !== material._id.toString());
  req.user.recentlyViewed.unshift({ material: material._id, viewedAt: new Date() });
  req.user.recentlyViewed = req.user.recentlyViewed.slice(0, 10);
  await req.user.save();

  const exp = Date.now() + VIEW_TOKEN_TTL_MS;
  const sig = buildViewSignature(req.user._id.toString(), material._id.toString(), exp);
  const secureFileUrl = `/view/${material._id}?exp=${exp}&sig=${sig}`;

  res.render('student/viewer', {
    material,
    watermark: `StudyAdda | ${req.user.email} | ${new Date().toISOString()}`,
    secureFileUrl,
    tokenExpiryMs: VIEW_TOKEN_TTL_MS
  });
};

module.exports.secureStream = async (req, res, next) => {
  try {
    // Rely on auth/subscription middleware + signed short-lived token for access control.
    const exp = Number(req.query.exp);
    const sig = req.query.sig;
    
    if (!exp || !sig || Number.isNaN(exp)) {
      return res.status(403).send('Invalid secure link');
    }
    
    if (Date.now() > exp) {
      return res.status(403).send('Secure link expired. Reopen from dashboard.');
    }

    const expectedSig = buildViewSignature(req.user._id.toString(), req.params.id.toString(), exp);
    const providedBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expectedSig);
    
    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return res.status(403).send('Invalid access signature');
    }

    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).send('Material not found');
    }
    
    // Serve from local file
    const filePath = path.join(__dirname, '..', 'views', material.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Material file not found');
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'display-capture=(), clipboard-read=(), clipboard-write=()');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; script-src 'self' 'unsafe-inline';");
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet, noimageindex');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports.toggleFavorite = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate material exists
    const material = await Material.findById(id);
    if (!material) {
      req.flash('error', 'Material not found');
      return res.redirect('/materials');
    }

    const idx = req.user.favorites.findIndex((fav) => fav.toString() === id);
    if (idx >= 0) {
      req.user.favorites.splice(idx, 1);
    } else {
      req.user.favorites.push(id);
    }
    await req.user.save();
    res.redirect('/materials');
  } catch (err) {
    next(err);
  }
};

module.exports.favoritesPage = async (req, res, next) => {
  try {
    const user = await req.user.populate({ path: 'favorites', populate: ['subject', 'branch', 'semester'] });
    res.render('student/favorites', { materials: user.favorites || [] });
  } catch (err) {
    next(err);
  }
};

module.exports.trackActivity = async (req, res, next) => {
  try {
    const { materialId, secondsSpent } = req.body;
    
    // Validate material exists
    if (!materialId) {
      return res.status(400).json({ error: 'Material ID required' });
    }
    
    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    await Activity.create({ user: req.user._id, material: materialId, secondsSpent: Number(secondsSpent) || 0 });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
