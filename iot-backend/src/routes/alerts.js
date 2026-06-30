const router = require('express').Router();
const auth = require('../middleware/auth');
const Alert = require('../models/Alert');

router.get('/', auth, async (req, res) => {
  try {
    const { resolved, limit = 100 } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/resolve', auth, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    if (!alert) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
