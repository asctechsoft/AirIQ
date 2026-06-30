const mqtt = require('mqtt');
const SensorData = require('../models/SensorData');
const Alert = require('../models/Alert');
const Settings = require('../models/Settings');

const connectMQTT = () => {
  const client = mqtt.connect(`mqtts://${process.env.MQTT_HOST}:8883`, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    clientId: `backend_${Math.random().toString(16).slice(2)}`,
    rejectUnauthorized: false,
  });

  client.on('connect', () => {
    console.log('MQTT connected!');
    client.subscribe('#', (err) => {
      if (err) console.error('Subscribe error:', err);
      else console.log('Subscribed to ALL topics!');
    });
  });

  client.on('message', async (topic, message) => {
    console.log('>>> Received:', topic, message.toString());
    try {
      const data = JSON.parse(message.toString());
      if (data.api_key !== process.env.DEVICE_API_KEY) {
        console.log('Invalid API key');
        return;
      }
      const saved = await SensorData.create({
        deviceId:    data.device_id,
        temperature: data.temperature,
        humidity:    data.humidity,
        co2:         data.co2,
      });
      console.log(`Saved: temp=${data.temperature} hum=${data.humidity} co2=${data.co2}`);
      await checkThresholds(saved);
    } catch (err) {
      console.error('MQTT message error:', err);
    }
  });

  client.on('error', (err) => console.error('MQTT error:', err));
  client.on('disconnect', () => console.log('MQTT disconnected!'));
  client.on('reconnect', () => console.log('MQTT reconnecting...'));
};

async function checkThresholds(data) {
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    const th = s.thresholds;

    const makeAlert = (type, value, threshold, message) =>
      Alert.create({ deviceId: data.deviceId, type, value, threshold, message });

    if (data.co2 >= th.co2_danger) {
      await makeAlert('co2', data.co2, th.co2_danger,
        `CO₂ nguy hiểm: ${data.co2}ppm (ngưỡng ${th.co2_danger}ppm)`);
    } else if (data.co2 >= th.co2_warn) {
      await makeAlert('co2', data.co2, th.co2_warn,
        `CO₂ cao: ${data.co2}ppm (ngưỡng ${th.co2_warn}ppm)`);
    }

    if (data.temperature >= th.temp_max) {
      await makeAlert('temperature', data.temperature, th.temp_max,
        `Nhiệt độ cao: ${data.temperature}°C (ngưỡng ${th.temp_max}°C)`);
    }

    if (data.humidity < th.humidity_min) {
      await makeAlert('humidity', data.humidity, th.humidity_min,
        `Độ ẩm quá thấp: ${data.humidity}% (ngưỡng ${th.humidity_min}%)`);
    } else if (data.humidity > th.humidity_max) {
      await makeAlert('humidity', data.humidity, th.humidity_max,
        `Độ ẩm quá cao: ${data.humidity}% (ngưỡng ${th.humidity_max}%)`);
    }
  } catch (err) {
    console.error('checkThresholds error:', err);
  }
}

module.exports = connectMQTT;