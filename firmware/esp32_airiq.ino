/*
 * AirIQ - ESP32 Firmware
 * Sensors : DHT22 (temp + humidity), Potentiometer trên pin 34 analog (giả lập CO2)
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
// Wokwi chỉ kết nối được WiFi ảo với SSID cố định 'Wokwi-GUEST', password rỗng.
#define WIFI_SSID  "Wokwi-GUEST"
#define WIFI_PASS  ""

// ── MQTT (HiveMQ Cloud) ───────────────────────────────
// NOTE: HiveMQ Cloud Free chỉ cho 1 cặp credential duy nhất/cluster (không
// tách được device vs backend ở tầng broker). Vì vậy KHÔNG share công khai
// link Wokwi project này (nó chứa credential thật) — lớp xác thực thiết bị
// thật sự nằm ở API_KEY bên dưới, được backend kiểm tra trước khi lưu DB.
#define MQTT_HOST  "5a9350d651684013a992df08a435f3b4.s1.eu.hivemq.cloud"
#define MQTT_PORT  8883
#define MQTT_USER  "iot_dsp_talent"
#define MQTT_PASS  "12345678@Abc"
#define MQTT_TOPIC "iot/airquality/room1"

// ── Device identity ───────────────────────────────────
#define DEVICE_ID  "esp32-room1"
#define API_KEY    "device-key-abc123"

// ── HiveMQ Cloud TLS root CA (Let's Encrypt ISRG Root X1) ─
// Xác thực chứng chỉ broker thay vì bỏ qua bằng setInsecure().
// Verified bằng: openssl s_client -connect <host>:8883 -CAfile isrgrootx1.pem
const char* HIVEMQ_ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

// ── Pins ──────────────────────────────────────────────
#define DHT_PIN    15   // khớp với dây SDA nối vào esp:D15 trong diagram.json
#define DHT_TYPE   DHT22
#define CO2_POT_PIN 34   // Potentiometer wiper — ADC1 channel, phải dùng ADC1 trên ESP32

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
  espClient.setCACert(HIVEMQ_ROOT_CA);
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

// ── CO2 simulation từ Potentiometer ────────────────────
// Xoay volume trên Wokwi để đổi giá trị CO2 giả lập.
float readCO2ppm() {
  int   raw  = analogRead(CO2_POT_PIN);
  float volt = raw * (3.3f / 4095.0f);
  // Mapping: 0V (vặn hết trái) → 400ppm, 3.3V (vặn hết phải) → 5000ppm
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
