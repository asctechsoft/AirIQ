/*
 * AirIQ - ESP32 Firmware
 * Sensors : DHT22 (temp + humidity), MQ135 (CO2 approx)
 * Protocol: MQTT over TLS → HiveMQ Cloud
 * Simulator: https://wokwi.com/projects/467067774859300865
 *
 * Libraries needed (Library Manager):
 *   - DHT sensor library (Adafruit)
 *   - Adafruit Unified Sensor
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson (Benoit Blanchon)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ── WiFi ──────────────────────────────────────────────
#define WIFI_SSID  "YOUR_WIFI_SSID"
#define WIFI_PASS  "YOUR_WIFI_PASSWORD"

// ── MQTT (HiveMQ Cloud) ───────────────────────────────
#define MQTT_HOST  "5a9350d651684013a992df08a435f3b4.s1.eu.hivemq.cloud"
#define MQTT_PORT  8883
#define MQTT_USER  "iot_dsp_talent"
#define MQTT_PASS  "12345678@Abc"
#define MQTT_TOPIC "iot/airquality/room1"

// ── Device identity ───────────────────────────────────
#define DEVICE_ID  "esp32-room1"
#define API_KEY    "device-key-abc123"

// ── Pins ──────────────────────────────────────────────
#define DHT_PIN    4
#define DHT_TYPE   DHT22
#define MQ135_PIN  34   // ADC1 channel — must use ADC1 on ESP32

// ── Timing ────────────────────────────────────────────
#define SEND_INTERVAL_MS 5000

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClientSecure espClient;
PubSubClient mqtt(espClient);

// ── WiFi ──────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
}

// ── MQTT ──────────────────────────────────────────────
void connectMQTT() {
  espClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);

  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = String("esp32_") + String(DEVICE_ID) + "_" + String(millis());
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" connected!");
    } else {
      Serial.printf(" failed (state=%d), retry in 5s\n", mqtt.state());
      delay(5000);
    }
  }
}

// ── CO2 estimation from MQ135 ─────────────────────────
// Note: MQ135 requires ~24h burn-in for accurate readings.
// This is a simplified linear mapping — calibrate RZERO for your unit.
float readCO2ppm() {
  int   raw  = analogRead(MQ135_PIN);
  float volt = raw * (3.3f / 4095.0f);
  // Approx mapping: 0V → 400ppm (fresh air), 3.3V → 5000ppm
  float ppm  = 400.0f + (volt / 3.3f) * 4600.0f;
  return constrain(ppm, 400.0f, 5000.0f);
}

// ── Setup ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  dht.begin();
  connectWiFi();
  connectMQTT();
  Serial.println("AirIQ ready — publishing every 5s");
}

// ── Loop ──────────────────────────────────────────────
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  static unsigned long lastSend = 0;
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[WARN] DHT22 read failed — skipping");
    return;
  }

  float co2 = readCO2ppm();

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["device_id"]   = DEVICE_ID;
  doc["api_key"]     = API_KEY;
  doc["temperature"] = round(temp * 10.0f) / 10.0f;
  doc["humidity"]    = round(hum  * 10.0f) / 10.0f;
  doc["co2"]         = (int)co2;

  char payload[256];
  serializeJson(doc, payload);

  bool ok = mqtt.publish(MQTT_TOPIC, payload, /*retained=*/false);
  Serial.printf("[%s] temp=%.1f hum=%.1f co2=%d → %s\n",
    ok ? "OK" : "FAIL", temp, hum, (int)co2, MQTT_TOPIC);
}
