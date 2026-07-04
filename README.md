# AirIQ — Hệ thống giám sát chất lượng không khí IoT

Dự án IoT full-stack: thiết bị ESP32 đo nhiệt độ / độ ẩm / CO₂, gửi dữ liệu qua MQTT
lên broker cloud, backend Node.js lắng nghe – lưu DB – cảnh báo ngưỡng, và
dashboard web (Vue 3) hiển thị realtime cho người dùng đã đăng nhập.

Mô phỏng phần cứng chạy trên Wokwi: https://wokwi.com/projects/467067774859300865

## Cấu trúc project

```
AirIQ/
├── firmware/
│   └── esp32_airiq.ino        # Firmware ESP32 (C++/Arduino)
├── iot-backend/                # API + MQTT subscriber (Node.js/Express)
│   ├── server.js               # Entry point
│   ├── .env                    # Cấu hình (Mongo, MQTT, JWT access+refresh, API key)
│   └── src/
│       ├── config/db.js        # Kết nối MongoDB
│       ├── mqtt/subscriber.js  # Subscribe MQTT, xác thực, lưu DB, sinh cảnh báo (có cooldown)
│       ├── models/              # SensorData, Alert, Settings, User (Mongoose schema)
│       ├── middleware/auth.js  # Middleware xác thực JWT cho API
│       └── routes/              # auth (login/register/refresh/logout), sensor, alerts, settings
└── iot-dashboard/               # Frontend (Vue 3 + Vite)
    └── src/
        ├── views/LoginView.vue      # Trang đăng nhập (Enter để submit, validate email)
        ├── views/RegisterView.vue   # Trang đăng ký tài khoản mới
        ├── views/DashboardView.vue  # Trang chính: 5 tab (Dashboard/Lịch sử/Cảnh báo/Thiết bị/Cài đặt)
        ├── components/MetricGaugeCard.vue  # Gauge tròn dùng chung cho các thẻ chỉ số
        ├── services/api.js          # Axios instance: tự gắn JWT, tự refresh token khi hết hạn
        ├── router/index.js          # Route guard (chặn vào /dashboard nếu chưa login)
        └── vite.config.js           # Cấu hình Vite (không bật vue-devtools overlay)
```

## Luồng dữ liệu tổng thể

```
ESP32 (DHT22 + biến trở giả lập CO2)
   │  đo mỗi 5s (đọc DHT22 có retry tối đa 3 lần), đóng gói JSON
   │  {device_id, api_key, temperature, humidity, co2}
   ▼
MQTT publish (mqtts://, TLS) → HiveMQ Cloud → topic "iot/airquality/room1"
   ▼
Backend subscribe topic "iot/airquality/#"
   │  kiểm tra api_key → lưu MongoDB (SensorData) → so ngưỡng (Settings)
   │  → tạo Alert nếu vượt ngưỡng (có cooldown 5 phút chống spam cảnh báo trùng)
   ▼
REST API (Express, JWT access+refresh, rate-limit, no-store cache)
   ▲
   │ poll mỗi 5s (sensor + alert stats) + tự refresh khi tab được focus lại
Dashboard Vue (gauge, mini-chart theo từng đại lượng, thống kê cảnh báo)
```

## Đã xử lý được gì

### Firmware (`firmware/esp32_airiq.ino`)
- Kết nối WiFi ảo Wokwi (`Wokwi-GUEST`), tự reconnect WiFi/MQTT khi mất kết nối.
- Đọc cảm biến DHT22 (nhiệt độ, độ ẩm) mỗi 5 giây. Có **delay 2s ổn định cảm biến** sau
  `dht.begin()` và **thử đọc lại tối đa 3 lần** (cách nhau 300ms) trước khi bỏ qua chu kỳ —
  DHT22 mô phỏng trên Wokwi hay đọc trượt ngẫu nhiên, đọc lỡ 1 lần trước đây sẽ bỏ luôn cả
  chu kỳ gửi, giờ đã bền hơn nhiều.
- Giả lập CO₂ bằng biến trở trên chân analog 34, map điện áp 0–3.3V → 400–5000ppm.
- Kết nối MQTT qua TLS (`WiFiClientSecure` + `setCACert`) tới HiveMQ Cloud, xác thực
  chứng chỉ broker bằng root CA (Let's Encrypt ISRG Root X1) — không dùng `setInsecure()`.
- Publish JSON payload gồm `device_id`, `api_key`, `temperature`, `humidity`, `co2` lên topic
  `iot/airquality/room1`.

### Backend (`iot-backend/`)
- **Kết nối MongoDB** (`src/config/db.js`) — remote MongoDB instance.
- **MQTT subscriber** (`src/mqtt/subscriber.js`):
  - Subscribe `iot/airquality/#` (QoS 1) qua `mqtts://` (TLS, port 8883).
  - Kiểm tra `api_key` trong payload trước khi lưu.
  - Lưu bản ghi vào collection `SensorData`.
  - So ngưỡng (`Settings`) → tạo `Alert` nếu vượt, có **cooldown 5 phút/loại/thiết bị** —
    tránh tạo hàng chục cảnh báo giống hệt nhau khi giá trị đứng yên ở mức vượt ngưỡng qua
    nhiều chu kỳ đọc liên tiếp.
- **REST API** (Express):
  - Rate limit **tách riêng**: `/api/auth/*` 30 request/15 phút (chống brute-force login),
    các API còn lại 120 request/**1 phút** (đủ rộng cho dashboard polling 5s, tránh tự
    chặn nhầm traffic hợp lệ).
  - Toàn bộ `/api/` trả header `Cache-Control: no-store` — dữ liệu sensor/cảnh báo đổi
    liên tục, không để trình duyệt/proxy cache lại response cũ.
  - `POST /api/auth/register` — validate định dạng email + mật khẩu ≥ 6 ký tự.
  - `POST /api/auth/login` — trả `token` (access, 15 phút) + `refreshToken` (7 ngày).
  - `POST /api/auth/refresh` — xoay vòng (rotate) cấp lại cặp token mới.
  - `POST /api/auth/logout` — thu hồi refresh token trong DB.
  - `GET /api/sensor/data|latest|history|export` — dữ liệu cảm biến (mới nhất, theo
    khoảng thời gian, xuất CSV).
  - `GET /api/alerts` — danh sách cảnh báo (lọc theo `resolved`).
  - `GET /api/alerts/stats` — tổng số, số chưa xử lý, phân theo loại (CO₂/nhiệt độ/độ ẩm).
  - `GET /api/alerts/weekly` — số cảnh báo 7 ngày gần nhất x theo loại (cho biểu đồ cột
    xếp chồng).
  - `PATCH /api/alerts/:id/resolve`, `DELETE /api/alerts/:id` — xử lý/xóa 1 cảnh báo.
  - `DELETE /api/alerts` — xóa hàng loạt theo filter hiện tại (`resolved=true/false` hoặc
    xóa hết).
  - `GET/PUT /api/settings` — xem/sửa ngưỡng cảnh báo.
  - Tất cả route trên (trừ `/auth/*`) đều yêu cầu JWT hợp lệ qua middleware `auth.js`.

### Frontend (`iot-dashboard/`)
- **Đăng nhập/Đăng ký**: `LoginView.vue` (bọc `<form>` nên nhấn Enter đăng nhập được luôn,
  validate email client-side, hiện banner khi vừa đăng ký xong) và `RegisterView.vue`
  (form Email/Mật khẩu/Nhập lại mật khẩu, link qua lại 2 trang).
- **Tự động refresh phiên** (`services/api.js`): interceptor bắt lỗi 401 → gọi
  `/auth/refresh` lấy token mới rồi tự retry request cũ, người dùng không nhận ra;
  chỉ đăng xuất + bật dialog "Phiên đăng nhập đã hết hạn" khi refresh token **thật sự**
  không hợp lệ (không đăng xuất oan vì lỗi mạng/rate-limit tạm thời).
- **Tự động đăng xuất khi rảnh tay 1 giờ** (bảo mật): theo dõi thao tác thật của người
  dùng (chuột/bàn phím/cuộn/chạm), hết 1h không thao tác thì bật dialog cảnh báo rồi
  đăng xuất, thu hồi refresh token phía backend.
- **Route guard** (`router/index.js`): chặn truy cập `/dashboard` nếu chưa có token.
- **Dashboard** (`DashboardView.vue`) — 5 tab trong 1 SPA:
  - *Dashboard*: 3 **gauge tròn** (Nhiệt độ/Độ ẩm/CO₂, màu theo mức good/warning/critical)
    kèm sparkline xu hướng, + 3 **mini-chart riêng trục** cho từng đại lượng (tách khỏi
    chart gộp cũ vì khác đơn vị/biên độ sẽ đè phẳng nhau), + biểu đồ cột xếp chồng
    "Cảnh báo theo ngày (7 ngày qua)".
  - *Lịch sử*: chọn khoảng thời gian (mặc định đúng giờ địa phương, có cảnh báo nếu chọn
    "Từ" sau "Đến"), 3 mini-chart tương tự Dashboard theo khoảng đã chọn, xuất CSV.
  - *Cảnh báo*: 2 thẻ thống kê (Tổng/Chưa xử lý) + biểu đồ cột phân loại, lọc chưa xử
    lý/tất cả, đánh dấu đã xử lý / xóa từng cái, **xóa hàng loạt** theo filter (có xác nhận).
    Badge số lượng ở sidebar tự cập nhật real-time (poll cùng nhịp 5s với dữ liệu cảm biến).
  - *Thiết bị*: thông tin kết nối (giao thức, broker, topic, chu kỳ gửi).
  - *Cài đặt*: chỉnh ngưỡng cảnh báo.
- `services/api.js`: axios instance tự động gắn `Authorization: Bearer <token>` vào mọi
  request, tự refresh khi cần (xem trên).

## 3 lớp bảo mật

**Bối cảnh:** HiveMQ Cloud (gói Free) chỉ cấp **một cặp username/password duy nhất** cho
cả cluster, nên không thể tách credential riêng cho từng thiết bị ở tầng broker. Vì vậy
hệ thống bù lại bằng cách chia bảo mật thành 3 lớp độc lập:

**Lớp 1 — Mã hóa & xác thực đường truyền MQTT (transport security)**
- Firmware kết nối broker qua `mqtts://` (TLS, cổng 8883), dùng `WiFiClientSecure.setCACert()`
  với root CA thật (ISRG Root X1) để **xác thực chứng chỉ broker**, thay vì bỏ qua bằng
  `setInsecure()` — chống giả mạo broker (MITM).
- Backend cũng subscribe qua `mqtts://...:8883` với cùng cơ chế TLS.
- Kết nối MQTT còn yêu cầu username/password cấp broker (`MQTT_USER`/`MQTT_PASS`) — chặn
  client lạ không có credential broker publish/subscribe được.

**Lớp 2 — Xác thực thiết bị ở tầng ứng dụng (device API key)**
- Vì mọi thiết bị dùng chung 1 credential MQTT, nên **không thể tin cậy chỉ dựa vào broker**.
- Mỗi payload thiết bị gửi lên đều kèm `api_key` (`DEVICE_API_KEY` trong `.env`).
- Backend (`subscriber.js`) kiểm tra `data.api_key !== process.env.DEVICE_API_KEY` **trước khi
  ghi DB** — payload sai/không có key bị log `Invalid API key` và loại bỏ, không lưu.
- Đây là lớp xác thực "device thật" độc lập với lớp broker, bù cho hạn chế của gói MQTT Free.

**Lớp 3 — Xác thực & phân quyền người dùng web (JWT + hashing + session hardening)**
- Mật khẩu người dùng được băm bằng `bcryptjs` (10 salt rounds) trước khi lưu — không lưu
  plaintext. Email được validate đúng định dạng (regex) và chuẩn hóa (`lowercase`/`trim`)
  cả ở frontend lẫn backend, cả lúc đăng ký lẫn đăng nhập.
- **Access + refresh token tách biệt**: access token (`JWT_SECRET`) sống ngắn — 15 phút;
  refresh token (`JWT_REFRESH_SECRET`, secret riêng) sống 7 ngày, lưu trong DB (`User.refreshToken`)
  để có thể **thu hồi** (logout, hoặc bị ghi đè khi rotate). Mỗi lần refresh đều cấp cặp
  token mới và vô hiệu hóa refresh token cũ — giảm rủi ro nếu token bị lộ mà không cần bắt
  người dùng đăng nhập lại liên tục.
- **Tự động đăng xuất sau 1h không thao tác** (idle timeout) — giảm rủi ro nếu người dùng
  quên đăng xuất trên máy dùng chung.
- Middleware `auth.js` chặn mọi route `/api/sensor`, `/api/alerts`, `/api/settings` nếu
  không có Bearer token hợp lệ trong header `Authorization`.
- `express-rate-limit` tách theo mục đích: `/api/auth/*` giới hạn chặt (30 req/15 phút)
  để chống brute-force login/register/refresh; các API còn lại giới hạn theo phút để không
  ảnh hưởng traffic polling hợp lệ nhưng vẫn chặn được lạm dụng.
- Toàn bộ response API mang header `Cache-Control: no-store` — tránh dữ liệu (bao gồm dữ
  liệu đã xác thực) bị cache lại ở tầng trình duyệt/proxy trung gian.
- Phía frontend: route guard chặn vào `/dashboard` nếu chưa có token trong `localStorage`;
  axios interceptor tự gắn token + tự refresh khi hết hạn; chỉ xóa phiên khi backend xác
  nhận refresh token thật sự không hợp lệ (không đăng xuất oan vì lỗi mạng/rate-limit).

> Lưu ý: `.env` và `esp32_airiq.ino` hiện đang chứa credential thật (MQTT password, JWT
> secret, API key) ở dạng plaintext trong code — vì Wokwi project không public nên chấp
> nhận được cho môi trường demo/học tập, nhưng **không nên commit các giá trị thật này lên
> repo public** hoặc dùng nguyên cho môi trường production.

## Cách chạy project

```bash
# 1. Backend
cd iot-backend
npm install
node server.js          # http://localhost:3000

# 2. Frontend
cd iot-dashboard
npm install
npm run dev              # http://localhost:5173 (hoặc port kế tiếp nếu bị chiếm)

# 3. Firmware
# Mở project Wokwi (link ở đầu file) → Start Simulation
# Thiết bị sẽ tự kết nối WiFi ảo + MQTT + gửi dữ liệu mỗi 5s
```

**Trạng thái đã test:** đã chạy thử end-to-end thành công — firmware publish → HiveMQ →
backend nhận, verify API key, lưu MongoDB, sinh cảnh báo khi vượt ngưỡng (có cooldown) →
dashboard hiển thị gauge/mini-chart/thống kê cảnh báo real-time; đăng ký, đăng nhập, refresh
token, logout, đăng xuất tự động sau 1h rảnh tay đều đã test thủ công qua curl/UI.

## Việc còn cần lưu ý / TODO
- Xoay vòng (rotate) các credential thật đang hardcode (`MQTT_PASS`, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, `DEVICE_API_KEY`) trước khi đưa lên môi trường thật hoặc repo public.
- Validate email mới chỉ kiểm tra **đúng định dạng**, chưa gửi email xác nhận thật (chưa
  verify email có tồn tại/thuộc sở hữu người đăng ký).
- Dashboard đang polling 5s (+ tự fetch khi tab được focus lại) thay vì đẩy dữ liệu real-time
  qua WebSocket/SSE.
- Biểu đồ "Cảnh báo theo ngày" cần có cảnh báo thật trong 7 ngày gần nhất mới có ý nghĩa —
  hiện tùy vào việc Wokwi simulation có đang chạy và CO₂ có vượt ngưỡng hay không.
- Node.js hiện tại (20.18.0) thấp hơn yêu cầu tối thiểu của Vite 8 (≥20.19) — nên nâng cấp
  để tránh cảnh báo/lỗi tương thích về sau.
