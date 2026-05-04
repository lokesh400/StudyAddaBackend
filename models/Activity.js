const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  secondsSpent: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
