const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { isLoggedIn } = require('../middleware/auth');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');

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

// Create a Razorpay order and return order details to client
router.post('/subscription/create-order', isLoggedIn, async (req, res, next) => {
  try {
    const amount = 29 * 100; // paise
    // Razorpay receipt length must be <= 40. Build a short receipt id.
    const receipt = `r_${req.user._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`;
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt });
    const publicKey = process.env.RAZORPAY_KEY_ID || process.env.key_id;
    if (!publicKey) return res.status(500).json({ ok: false, message: 'Razorpay key is not configured.' });
    res.json({ ok: true, orderId: order.id, amount: order.amount, currency: order.currency, key: publicKey });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.error?.description || err.message || 'Failed to create payment order.' });
  }
});

// Confirm payment after checkout (client posts razorpay_payment_id, razorpay_order_id, razorpay_signature)
router.post('/subscription/confirm', isLoggedIn, async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const signingSecret = process.env.RAZORPAY_KEY_SECRET || process.env.key_secret;
    if (!signingSecret) return res.status(500).json({ ok: false, message: 'Payment secret missing on server.' });
    const generated_signature = crypto.createHmac('sha256', signingSecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ ok: false, message: 'Invalid signature' });
    }

    // Payment verified - update user subscription
    const now = new Date();
    let expiry;
    
    // Check if user has active subscription
    if (req.user.subscriptionExpiry && req.user.subscriptionExpiry > now) {
      // Add 29 days to existing expiry
      expiry = new Date(req.user.subscriptionExpiry);
      expiry.setDate(expiry.getDate() + 29);
    } else {
      // Create new subscription from today
      expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 1);
      req.user.subscriptionStart = now;
    }
    
    req.user.subscriptionExpiry = expiry;
    await req.user.save();

    // Record payment
    await Payment.create({ user: req.user._id, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, amount: 29 * 100, status: 'paid' });

    req.flash('success', 'Subscription activated.');
    res.json({ ok: true, message: 'Subscription activated' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || 'Payment confirmation failed.' });
  }
});

// Razorpay webhook endpoint (optional): verify using webhook secret
router.post('/razorpay/webhook', express.json({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  if (expected !== signature) return res.status(400).send('invalid signature');

  // handle events (payment.captured etc.)
  // For now, just ack
  res.json({ ok: true });
});
router.post('/logout', isLoggedIn, authController.logout);

router.get('/profile', isLoggedIn, authController.profilePage);

module.exports = router;
