const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  deviceId:  { type: String, required: true },
  type:      { type: String, enum: ['co2', 'temperature', 'humidity'], required: true },
  value:     { type: Number, required: true },
  threshold: { type: Number, required: true },
  message:   { type: String, required: true },
  resolved:  { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
