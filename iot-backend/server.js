require('dotenv').config({ path: '.env' });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const connectMQTT = require('./src/mqtt/subscriber');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Quá nhiều request, thử lại sau!' }
}));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/sensor', require('./src/routes/sensor'));

app.get('/', (req, res) => res.json({ message: 'IoT Backend running!' }));

// Khởi động
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  connectMQTT();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});