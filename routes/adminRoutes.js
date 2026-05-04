const express = require('express');
const adminController = require('../controllers/adminController');
const upload = require('../utils/cloudinaryUpload');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(isLoggedIn, isAdmin);

router.get('/materials', adminController.dashboard);
router.post('/materials', upload.single('pdf'), adminController.uploadMaterial);
router.delete('/materials/:id', adminController.deleteMaterial);

router.post('/departments', adminController.createDepartment);
router.put('/departments/:id', adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

router.post('/branches', adminController.createBranch);
router.put('/branches/:id', adminController.updateBranch);
router.delete('/branches/:id', adminController.deleteBranch);

router.post('/semesters', adminController.createSemester);
router.put('/semesters/:id', adminController.updateSemester);
router.delete('/semesters/:id', adminController.deleteSemester);

router.post('/subjects', adminController.createSubject);
router.put('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

module.exports = router;
