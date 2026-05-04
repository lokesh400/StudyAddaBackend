const User = require('../models/User');

module.exports.renderRegister = (req, res) => res.render('auth/register');
module.exports.renderLogin = (req, res) => res.render('auth/login');

module.exports.register = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = new User({ email, role: email === process.env.ADMIN_EMAIL ? 'admin' : 'student' });
    await User.register(user, password);
    req.login(user, (err) => {
      if (err) return next(err);
      req.flash('success', 'Welcome to StudyAdda!');
      res.redirect('/materials');
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/register');
  }
};

module.exports.subscriptionPage = (req, res) => res.render('student/subscription');

module.exports.activateSubscription = async (req, res) => {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);

  req.user.subscriptionStart = now;
  req.user.subscriptionExpiry = expiry;
  await req.user.save();

  req.flash('success', 'Subscription activated: Rs.29/month plan.');
  res.redirect('/materials');
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success', 'Logged out successfully.');
    res.redirect('/login');
  });
};
