const mqtt = require('mqtt');
const SensorData = require('../models/SensorData');

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
        console.log('Invalid API key:', data.api_key, '!==', process.env.DEVICE_API_KEY);
        return;
      }
      await SensorData.create({
        deviceId:    data.device_id,
        temperature: data.temperature,
        humidity:    data.humidity,
        co2:         data.co2,
      });
      console.log(`Saved: temp=${data.temperature} hum=${data.humidity} co2=${data.co2}`);
    } catch (err) {
      console.error('MQTT message error:', err);
    }
  });

  client.on('error', (err) => console.error('MQTT error:', err));
  client.on('disconnect', () => console.log('MQTT disconnected!'));
  client.on('reconnect', () => console.log('MQTT reconnecting...'));
};

module.exports = connectMQTT;