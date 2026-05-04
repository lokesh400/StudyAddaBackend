const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true, index: true },
  public_id: { type: String, required: true, unique: true },
  uploadedAt: { type: Date, default: Date.now }
});

materialSchema.index({ title: 'text' });

module.exports = mongoose.model('Material', materialSchema);
