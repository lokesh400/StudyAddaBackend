const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true, min: 1, max: 20 },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true }
  },
  { timestamps: true }
);

semesterSchema.index({ branch: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('Semester', semesterSchema);
