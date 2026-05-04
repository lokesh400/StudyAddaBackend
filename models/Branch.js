const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }
  },
  { timestamps: true }
);

branchSchema.index({ name: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
