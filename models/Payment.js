const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: String,
  raw: Object
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
