module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    // If this is a fetch/API request, return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/view/')) {
      return res.status(403).json({ error: 'Authentication required' });
    }
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
    // If this is a fetch/API request (like PDF stream), return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json') || req.path.startsWith('/view/')) {
      return res.status(403).send('Subscription required. Renew at Rs.29/month to continue.');
    }
    req.flash('error', 'Your subscription has expired. Renew at Rs.29/month to continue.');
    return res.redirect('/subscription');
  }
  next();
};
