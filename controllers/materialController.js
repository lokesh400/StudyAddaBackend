const axios = require('axios');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const Material = require('../models/Material');
const Activity = require('../models/Activity');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');

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

module.exports.setCohort = async (req, res) => {
  const { departmentId, branchId, semesterId } = req.body;
  req.user.cohort = { department: departmentId, branch: branchId, semester: semesterId };
  await req.user.save();
  req.flash('success', 'Cohort updated successfully.');
  res.redirect('/materials');
};

module.exports.getBranches = async (req, res) => {
  const branches = await Branch.find({ department: req.params.departmentId }).sort({ name: 1 });
  res.json(branches);
};

module.exports.getSemesters = async (req, res) => {
  const semesters = await Semester.find({ branch: req.params.branchId }).sort({ number: 1 });
  res.json(semesters);
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
    // Header-based gating (sec-fetch-dest/referer) can break on some mobile browsers.
    const exp = Number(req.query.exp);
    const sig = req.query.sig;
    if (!exp || !sig || Number.isNaN(exp)) return res.status(403).send('Invalid secure link');
    if (Date.now() > exp) return res.status(403).send('Secure link expired. Reopen from dashboard.');

    const expectedSig = buildViewSignature(req.user._id.toString(), req.params.id.toString(), exp);
    const providedBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expectedSig);
    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return res.status(403).send('Invalid access signature');
    }

    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).send('Material not found');

    const signedUrl = cloudinary.utils.private_download_url(material.public_id, 'pdf', {
      resource_type: 'raw',
      type: 'private',
      expires_at: Math.floor(Date.now() / 1000) + 60,
      attachment: false
    });

    const response = await axios.get(signedUrl, { responseType: 'stream', timeout: 15000 });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'display-capture=(), clipboard-read=(), clipboard-write=()');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self';");
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet, noimageindex');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');

    response.data.pipe(res);
  } catch (err) { next(err); }
};

module.exports.toggleFavorite = async (req, res) => {
  const { id } = req.params;
  const idx = req.user.favorites.findIndex((fav) => fav.toString() === id);
  if (idx >= 0) req.user.favorites.splice(idx, 1); else req.user.favorites.push(id);
  await req.user.save();
  res.redirect('/materials');
};

module.exports.favoritesPage = async (req, res) => {
  const user = await req.user.populate({ path: 'favorites', populate: ['subject', 'branch', 'semester'] });
  res.render('student/favorites', { materials: user.favorites || [] });
};

module.exports.trackActivity = async (req, res) => {
  const { materialId, secondsSpent } = req.body;
  await Activity.create({ user: req.user._id, material: materialId, secondsSpent: Number(secondsSpent) || 0 });
  res.json({ ok: true });
};
