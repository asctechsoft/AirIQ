const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signAccessToken = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

const signRefreshToken = (user) =>
  jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

// Đăng ký
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không đúng định dạng' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: 'Email đã tồn tại' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email: normalizedEmail, password: hashed });
    res.json({ message: 'Đăng ký thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không đúng định dạng' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Email không tồn tại' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Sai mật khẩu' });

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({ token, refreshToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cấp lại access token bằng refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Thiếu refresh token' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }

    const newToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Đăng xuất — thu hồi refresh token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      try {
        const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        await User.findByIdAndUpdate(payload.userId, { refreshToken: null });
      } catch {
        // token đã hết hạn/không hợp lệ — không cần xử lý gì thêm
      }
    }
    res.json({ message: 'Đã đăng xuất' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;