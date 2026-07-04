# Hướng dẫn cài đặt & chạy project AirIQ (cho thành viên nhóm)

Tài liệu này dành cho các bạn **clone code về máy mới** và cần chạy được toàn bộ hệ thống
(backend + dashboard + firmware mô phỏng). Không cần xin lại credential — `.env` đã có sẵn
trong repo (đã commit cùng code).

## 0. Yêu cầu trước khi bắt đầu

- **Node.js** ≥ 20.19 hoặc ≥ 22.12 (khuyến nghị). Bản 20.18.x vẫn chạy được nhưng Vite sẽ
  cảnh báo phiên bản không đủ, nên nâng cấp nếu tiện: https://nodejs.org/
- **Git** để clone repo.
- Trình duyệt hiện đại (Chrome/Edge) — không cần cài MongoDB hay MQTT broker cục bộ, vì cả
  hai đều dùng **dịch vụ cloud dùng chung** cho cả nhóm (chi tiết bên dưới).
- Tài khoản Wokwi (miễn phí) nếu muốn tự chạy mô phỏng firmware — không bắt buộc phải có
  tài khoản mới xem được, nhưng cần có mới bấm Start Simulation được lâu dài.

## 1. Clone và cài đặt

```bash
git clone <link-repo-cua-nhom>
cd AirIQ

# Backend
cd iot-backend
npm install

# Frontend
cd ../iot-dashboard
npm install
```

`npm install` vẫn nên chạy dù `node_modules` có thể đã có sẵn trong repo (xem mục 6 —
đây là một vấn đề cần dọn dẹp), để đảm bảo đúng bản build cho máy của bạn (Windows/Mac/Linux
có thể build lại các gói native khác nhau).

## 2. File `.env` — không cần tự tạo

File `iot-backend/.env` **đã có sẵn trong repo**, chứa toàn bộ cấu hình dùng chung của cả
nhóm — bạn không cần tạo file mới hay xin ai credential:

```
PORT=3000
MONGODB_URI=mongodb://...              # MongoDB dùng chung cho cả nhóm
JWT_SECRET=...                         # Ký access token
JWT_REFRESH_SECRET=...                 # Ký refresh token (khác secret với access token)
MQTT_HOST=...hivemq.cloud              # Broker HiveMQ Cloud dùng chung
MQTT_PORT=1883
MQTT_USER=...
MQTT_PASS=...
MQTT_TOPIC="iot/airquality/#"
DEVICE_API_KEY=...                     # Mã xác thực thiết bị, backend kiểm tra trước khi lưu DB
```

> ⚠️ Vì đây là credential thật dùng chung cho cả nhóm, **không share ra ngoài nhóm** (không
> đăng public repo lên GitHub public, không paste vào đâu công khai). Ai cũng đang dùng
> chung một MongoDB và một broker MQTT, nên dữ liệu của người này người khác đều thấy được.

## 3. Chạy backend

```bash
cd iot-backend
node server.js
```

Thấy log như sau là backend đã chạy đúng, sẵn sàng nhận dữ liệu:

```
MongoDB connected!
Server running on port 3000
MQTT connected!
Subscribed to iot/airquality/# (QoS 1)
```

Nếu dừng ở `MongoDB connected!` mà không thấy `MQTT connected!`, kiểm tra lại mạng (một số
mạng công ty/trường học chặn cổng 8883 ra ngoài).

## 4. Chạy dashboard (frontend)

```bash
cd iot-dashboard
npm run dev
```

Mở trình duyệt tới địa chỉ hiện trong terminal (mặc định `http://localhost:5173`, nếu port
bị chiếm Vite tự đổi sang 5174/5175...).

Vì DB dùng chung, tài khoản đăng nhập của người tạo trước đó vẫn dùng được — không cần đăng
ký lại nếu ai đó trong nhóm đã có tài khoản. Muốn tạo tài khoản riêng thì vào trang đăng nhập
bấm "Đăng ký".

## 5. Chạy mô phỏng firmware trên Wokwi

Vì HiveMQ Cloud gói Free chỉ cho **một cặp credential MQTT duy nhất** dùng chung cho cả
cluster, cả nhóm **dùng chung một project Wokwi** để mô phỏng thiết bị — không phải ai cũng
tự tạo project Wokwi riêng của mình:

1. Xin link project Wokwi từ người giữ link (không đăng công khai — project này chứa
   credential MQTT thật trong code `esp32_airiq.ino`).
2. Mở link, bấm nút ▶ (Start Simulation) ở góc trên bên trái.
3. Theo dõi Serial Monitor bên phải — thấy dòng `[OK] temp=... hum=... co2=... -> iot/airquality/room1`
   lặp lại mỗi 5 giây là thiết bị đang gửi dữ liệu bình thường.
4. Xoay volume (potentiometer) trên mạch để đổi giá trị CO2 giả lập, quan sát dashboard cập
   nhật theo thời gian thực.

**Chỉ nên có MỘT người chạy Wokwi tại một thời điểm khi demo/test**, vì tất cả cùng publish
lên chung một topic với cùng `device_id` — nếu hai người cùng chạy song song, dữ liệu của cả
hai sẽ xen kẽ nhau trên cùng một biểu đồ, gây rối khi debug.

Nếu code firmware trong repo (`firmware/esp32_airiq.ino`) có thay đổi, cần copy nội dung mới
paste đè vào tab `sketch.ino` trên Wokwi rồi bấm Start lại — Wokwi không tự đồng bộ với
git, đây là 2 nơi lưu code tách biệt.

## 6. Các vấn đề thường gặp (đã tự xử lý trong lúc phát triển)

| Hiện tượng | Nguyên nhân | Đã xử lý thế nào |
|---|---|---|
| Serial Monitor báo `[WARN] DHT22 read failed` liên tục, dashboard không có dữ liệu mới | Cảm biến DHT22 mô phỏng trên Wokwi đọc trượt ngẫu nhiên, cần thời gian ổn định | Firmware đã có delay 2s sau khi khởi tạo + tự thử đọc lại 3 lần trước khi bỏ qua chu kỳ |
| Dashboard đứng số liệu, phải F5 mới thấy mới | Có thể do cache HTTP hoặc tab bị trình duyệt cho vào nền | Backend đã set `Cache-Control: no-store`; dashboard tự fetch lại khi tab được focus lại |
| Vào tab Lịch sử tìm hoài không ra dữ liệu | Chọn "Từ ngày" muộn hơn "Đến ngày" | Giờ đã có cảnh báo đỏ báo rõ khi chọn sai thứ tự; mặc định 24h gần nhất tính đúng theo giờ máy |
| Bị đăng xuất bất thường dù mới đăng nhập | Rate-limit cũ (100 req/15 phút) quá thấp so với tần suất polling 5s của dashboard | Đã tách rate-limit: nhóm auth 30 req/15 phút, nhóm API dữ liệu 120 req/phút |
| Cả chục cảnh báo CO₂ giống hệt nhau xuất hiện liên tiếp | Mỗi message MQTT vượt ngưỡng đều tạo alert mới, không có cơ chế chống trùng | Đã thêm cooldown 5 phút/loại/thiết bị — vượt ngưỡng liên tục chỉ tạo 1 cảnh báo trong 5 phút |

## 7. Ghi chú dọn dẹp repo (cần làm nhưng chưa làm)

Repo hiện **chưa có file `.gitignore`**, dẫn tới toàn bộ `node_modules` của cả backend lẫn
frontend đã bị commit thẳng lên git (hàng nghìn file), khiến repo nặng bất thường và dễ xung
đột merge khi mỗi người cài dependency trên máy khác nhau (Windows/Mac build binary khác nhau
cho cùng một package). Nên bổ sung `.gitignore` (bỏ qua `node_modules/`, có thể cân nhắc cả
`.env` nếu sau này muốn tách credential thật ra khỏi git) và dọn lại lịch sử — việc này ảnh
hưởng tới toàn bộ nhóm nên cần bàn trước khi làm, chưa tự động thực hiện trong tài liệu này.
