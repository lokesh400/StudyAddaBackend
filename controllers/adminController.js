const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const Material = require('../models/Material');
const Department = require('../models/Department');
const Branch = require('../models/Branch');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Payment = require('../models/Payment');
const path = require('path');
const fs = require('fs');

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
    const { title, subject, branch, semester } = req.body;

    // Fetch department, branch, and semester names
    const branchDoc = await Branch.findById(branch).populate('department');
    const semesterDoc = await Semester.findById(semester);

    if (!branchDoc || !semesterDoc) {
      req.flash('error', 'Invalid branch or semester');
      return res.redirect('/admin/materials');
    }

    const deptName = branchDoc.department.name;
    const branchName = branchDoc.name;
    const semesterName = semesterDoc.name;

    // Construct file path: views/content/{Department}/{Branch}/{Semester}/{title}.html
    const relativePath = path.join('content', deptName, branchName, semesterName, `${title}.html`);

    // Create material record
    await Material.create({ title, subject, branch, semester, filePath: relativePath });
    req.flash('success', 'Material added successfully.');
    res.redirect('/admin/materials');
  } catch (err) { next(err); }
};

module.exports.deleteMaterial = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) { req.flash('error', 'Material not found'); return res.redirect('/admin/materials'); }
    // Just delete the database record; the HTML file remains in the folder for potential reuse
    await Material.findByIdAndDelete(req.params.id);
    req.flash('success', 'Material record deleted.');
    res.redirect('/admin/materials');
  } catch (err) { next(err); }
};
