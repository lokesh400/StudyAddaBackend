const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true }
  },
  { timestamps: true }
);

subjectSchema.index({ semester: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
