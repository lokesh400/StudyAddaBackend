const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const Material = require('../models/Material');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Payment = require('../models/Payment');

module.exports.dashboard = async (req, res) => {
  const [materials, departments, branches, semesters, subjects] = await Promise.all([
    Material.find().populate('subject branch semester').sort({ uploadedAt: -1 }),
    Department.find().sort({ name: 1 }),
    Branch.find().populate('department').sort({ name: 1 }),
    Semester.find().populate('branch').sort({ number: 1 }),
    Subject.find().populate('semester').sort({ name: 1 })
  ]);

  // admin stats
  const totalUsers = await User.countDocuments();
  const activeSubscriptions = await User.countDocuments({ subscriptionExpiry: { $gt: new Date() } });
  const totalPayments = await Payment.countDocuments();
  const payingUsers = await Payment.distinct('user');

  res.render('admin/dashboard', { materials, departments, branches, semesters, subjects, stats: { totalUsers, activeSubscriptions, totalPayments, payingUsers: payingUsers.length } });
};

module.exports.createDepartment = async (req, res) => { await Department.create({ name: req.body.name }); req.flash('success', 'Department added.'); res.redirect('/admin/materials'); };
module.exports.updateDepartment = async (req, res) => { await Department.findByIdAndUpdate(req.params.id, { name: req.body.name }); req.flash('success', 'Department updated.'); res.redirect('/admin/materials'); };
module.exports.deleteDepartment = async (req, res) => { await Department.findByIdAndDelete(req.params.id); req.flash('success', 'Department deleted.'); res.redirect('/admin/materials'); };

module.exports.createBranch = async (req, res) => { await Branch.create({ name: req.body.name, department: req.body.department }); req.flash('success', 'Branch added.'); res.redirect('/admin/materials'); };
module.exports.updateBranch = async (req, res) => { await Branch.findByIdAndUpdate(req.params.id, { name: req.body.name, department: req.body.department }); req.flash('success', 'Branch updated.'); res.redirect('/admin/materials'); };
module.exports.deleteBranch = async (req, res) => { await Branch.findByIdAndDelete(req.params.id); req.flash('success', 'Branch deleted.'); res.redirect('/admin/materials'); };

module.exports.createSemester = async (req, res) => { await Semester.create({ name: req.body.name, number: req.body.number, branch: req.body.branch }); req.flash('success', 'Semester added.'); res.redirect('/admin/materials'); };
module.exports.updateSemester = async (req, res) => { await Semester.findByIdAndUpdate(req.params.id, { name: req.body.name, number: req.body.number, branch: req.body.branch }); req.flash('success', 'Semester updated.'); res.redirect('/admin/materials'); };
module.exports.deleteSemester = async (req, res) => { await Semester.findByIdAndDelete(req.params.id); req.flash('success', 'Semester deleted.'); res.redirect('/admin/materials'); };

module.exports.createSubject = async (req, res) => { await Subject.create({ name: req.body.name, code: req.body.code, semester: req.body.semester }); req.flash('success', 'Subject added.'); res.redirect('/admin/materials'); };
module.exports.updateSubject = async (req, res) => { await Subject.findByIdAndUpdate(req.params.id, { name: req.body.name, code: req.body.code, semester: req.body.semester }); req.flash('success', 'Subject updated.'); res.redirect('/admin/materials'); };
module.exports.deleteSubject = async (req, res) => { await Subject.findByIdAndDelete(req.params.id); req.flash('success', 'Subject deleted.'); res.redirect('/admin/materials'); };

module.exports.uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) { req.flash('error', 'PDF file is required'); return res.redirect('/admin/materials'); }
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'raw', type: 'private', folder: 'studyadda', format: 'pdf' }, (err, result) => (err ? reject(err) : resolve(result)));
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });
    const { title, subject, branch, semester } = req.body;
    await Material.create({ title, subject, branch, semester, public_id: uploadResult.public_id });
    req.flash('success', 'Material uploaded successfully.');
    res.redirect('/admin/materials');
  } catch (err) { next(err); }
};

module.exports.deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) { req.flash('error', 'Material not found'); return res.redirect('/admin/materials'); }
    await cloudinary.uploader.destroy(material.public_id, { resource_type: 'raw', type: 'private' });
    await Material.findByIdAndDelete(req.params.id);
    req.flash('success', 'Material deleted successfully.');
    res.redirect('/admin/materials');
  } catch (err) { next(err); }
};
