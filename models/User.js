const mongoose = require('mongoose');
const plm = require('passport-local-mongoose');
const passportLocalMongoose = plm.default || plm;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  subscriptionStart: { type: Date },
  subscriptionExpiry: { type: Date },
  cohort: {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    semester: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' }
  },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
  recentlyViewed: [{ material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' }, viewedAt: { type: Date, default: Date.now } }]
}, { timestamps: true });

userSchema.methods.hasActiveSubscription = function hasActiveSubscription() {
  return this.subscriptionExpiry && this.subscriptionExpiry > new Date();
};

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.model('User', userSchema);
