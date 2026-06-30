const router = require('express').Router();
const auth = require('../middleware/auth');
const Settings = require('../models/Settings');

router.get('/', auth, async (req, res) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const update = {};
    for (const [k, v] of Object.entries(req.body)) {
      update[`thresholds.${k}`] = Number(v);
    }
    const s = await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    );
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
