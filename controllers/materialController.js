const axios = require('axios');
const cloudinary = require('../config/cloudinary');
const Material = require('../models/Material');
const Activity = require('../models/Activity');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');

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

  res.render('student/viewer', { material, watermark: `StudyAdda | ${req.user.email} | ${new Date().toISOString()}` });
};

module.exports.secureStream = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).send('Material not found');
    const signedUrl = cloudinary.utils.private_download_url(material.public_id, 'pdf', { resource_type: 'raw', type: 'private', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false });
    const response = await axios.get(signedUrl, { responseType: 'stream' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="studyadda.pdf"');
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
