const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không đúng định dạng'],
  },
  password:     { type: String, required: true },
  refreshToken: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);