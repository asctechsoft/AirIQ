const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  thresholds: {
    temp_max:     { type: Number, default: 35 },
    humidity_min: { type: Number, default: 30 },
    humidity_max: { type: Number, default: 70 },
    co2_warn:     { type: Number, default: 800 },
    co2_danger:   { type: Number, default: 1000 },
  }
});

module.exports = mongoose.model('Settings', settingsSchema);
