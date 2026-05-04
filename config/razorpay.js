const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error('Razorpay keys missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment.');
}

const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });

module.exports = instance;
