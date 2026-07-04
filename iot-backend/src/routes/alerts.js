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

// Thống kê nhanh cho dashboard cảnh báo (tổng số, chưa xử lý, phân theo loại)
router.get('/stats', auth, async (req, res) => {
  try {
    const [total, unresolved, byTypeAgg] = await Promise.all([
      Alert.countDocuments({}),
      Alert.countDocuments({ resolved: false }),
      Alert.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    ]);

    const byType = { co2: 0, temperature: 0, humidity: 0 };
    byTypeAgg.forEach(t => { byType[t._id] = t.count; });

    res.json({ total, unresolved, byType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Số cảnh báo theo ngày (7 ngày gần nhất) x theo loại — cho biểu đồ cột xếp chồng
router.get('/weekly', auth, async (req, res) => {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    const agg = await Alert.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' },
          count: { $sum: 1 },
        },
      },
    ]);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const result = days.map(day => {
      const entry = { date: day, co2: 0, temperature: 0, humidity: 0 };
      agg.filter(a => a._id.day === day).forEach(a => { entry[a._id.type] = a.count; });
      return entry;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xóa hàng loạt — theo filter hiện tại của client (resolved=true/false) hoặc xóa hết
router.delete('/', auth, async (req, res) => {
  try {
    const { resolved } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';
    const result = await Alert.deleteMany(filter);
    res.json({ message: 'Đã xóa', deletedCount: result.deletedCount });
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
