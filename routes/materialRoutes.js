const express = require('express');
const materialController = require('../controllers/materialController');
const { isLoggedIn, isSubscribed } = require('../middleware/auth');

const router = express.Router();
router.get('/materials', isLoggedIn, materialController.listMaterials);
router.post('/cohort', isLoggedIn, materialController.setCohort);
router.get('/api/departments/:departmentId/branches', isLoggedIn, materialController.getBranches);
router.get('/api/branches/:branchId/semesters', isLoggedIn, materialController.getSemesters);
router.get('/materials/:id/read', isLoggedIn, isSubscribed, materialController.viewerPage);
router.get('/view/:id', isLoggedIn, isSubscribed, materialController.secureStream);
router.post('/materials/:id/favorite', isLoggedIn, materialController.toggleFavorite);
router.get('/favorites', isLoggedIn, materialController.favoritesPage);
router.post('/activity', isLoggedIn, materialController.trackActivity);

module.exports = router;
