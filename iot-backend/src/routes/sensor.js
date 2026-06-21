const router = require('express').Router();
const auth = require('../middleware/auth');
const SensorData = require('../models/SensorData');

// Lấy 100 bản ghi mới nhất
router.get('/data', auth, async (req, res) => {
  try {
    const data = await SensorData.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy giá trị mới nhất
router.get('/latest', auth, async (req, res) => {
  try {
    const latest = await SensorData.findOne().sort({ timestamp: -1 });
    res.json(latest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Lấy data theo khoảng thời gian
router.get('/history', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await SensorData.find({
      timestamp: {
        $gte: new Date(from || Date.now() - 24*60*60*1000),
        $lte: new Date(to || Date.now()),
      }
    }).sort({ timestamp: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;