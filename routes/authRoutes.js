const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { isLoggedIn } = require('../middleware/auth');

const router = express.Router();

router.get('/register', authController.renderRegister);
router.post('/register', authController.register);

router.get('/login', authController.renderLogin);

router.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    req.flash('success', 'Welcome back!');
    res.redirect('/materials');
  }
);

router.get('/subscription', isLoggedIn, authController.subscriptionPage);
router.post('/subscription/activate', isLoggedIn, authController.activateSubscription);
router.post('/logout', isLoggedIn, authController.logout);

module.exports = router;
