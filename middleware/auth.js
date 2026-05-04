module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.flash('error', 'Please login first.');
    return res.redirect('/login');
  }
  next();
};

module.exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    req.flash('error', 'Admin access required.');
    return res.redirect('/materials');
  }
  next();
};

module.exports.isSubscribed = (req, res, next) => {
  if (!req.user || !req.user.subscriptionExpiry || req.user.subscriptionExpiry <= new Date()) {
    req.flash('error', 'Your subscription has expired. Renew at Rs.29/month to continue.');
    return res.redirect('/subscription');
  }
  next();
};
