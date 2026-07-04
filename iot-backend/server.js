require('dotenv').config({ path: '.env' });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const connectMQTT = require('./src/mqtt/subscriber');

const app = express();

app.use(cors());
app.use(express.json());

// Dữ liệu cảm biến/cảnh báo thay đổi liên tục — chặn browser/proxy cache lại
// response cũ, tránh dashboard polling nhận mãi 1 bản ghi cũ.
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Rate limit riêng cho auth (chống brute-force login/register/refresh) — số request thấp vì
// đây là các hành động không lặp lại liên tục.
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Quá nhiều request, thử lại sau!' }
}));

// Rate limit chung cho các API còn lại. Dashboard polling mỗi 5s (~2 request/lần) nên cần
// hạn mức rộng hơn nhiều so với auth — nếu để thấp sẽ tự chặn nhầm chính traffic hợp lệ,
// kéo theo cả request refresh-token bị 429 và bắt đăng nhập lại oan.
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Quá nhiều request, thử lại sau!' }
}));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/sensor', require('./src/routes/sensor'));
app.use('/api/alerts', require('./src/routes/alerts'));
app.use('/api/settings', require('./src/routes/settings'));

app.get('/', (req, res) => res.json({ message: 'IoT Backend running!' }));

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  connectMQTT();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});