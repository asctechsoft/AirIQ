# Tài liệu tham khảo — Biến môi trường & Lệnh thường dùng

File này gom lại toàn bộ **key cấu hình** và **lệnh hay dùng** trong quá trình phát triển/vận
hành project, để tra cứu nhanh thay vì phải nhớ hoặc lục lại code. Đi kèm với `README.md`
(tổng quan project) và `HUONG_DAN_CHAY_PROJECT.md` (hướng dẫn cài đặt cho người mới).

## 1. Biến môi trường (`iot-backend/.env`)

| Key | Ý nghĩa | Dùng ở đâu |
|---|---|---|
| `PORT` | Cổng HTTP backend lắng nghe | `server.js` |
| `MONGODB_URI` | Chuỗi kết nối MongoDB dùng chung cho cả nhóm | `src/config/db.js` |
| `JWT_SECRET` | Khóa ký **access token** (hiệu lực 15 phút) | `routes/auth.js`, `middleware/auth.js` |
| `JWT_REFRESH_SECRET` | Khóa ký **refresh token** (hiệu lực 7 ngày) — cố ý tách riêng với `JWT_SECRET` | `routes/auth.js` |
| `MQTT_HOST` | Địa chỉ broker HiveMQ Cloud | `src/mqtt/subscriber.js`, firmware |
| `MQTT_PORT` | Cổng MQTT (backend dùng 8883/TLS khi connect thật, giá trị trong `.env` chỉ tham khảo) | `src/mqtt/subscriber.js` |
| `MQTT_USER` / `MQTT_PASS` | Tài khoản đăng nhập broker (dùng chung 1 cặp cho cả cluster — giới hạn của gói Free) | `src/mqtt/subscriber.js`, firmware |
| `MQTT_TOPIC` | Topic backend subscribe, dạng wildcard `iot/airquality/#` | `src/mqtt/subscriber.js` |
| `DEVICE_API_KEY` | Mã xác thực thiết bị ở **tầng ứng dụng** (Lớp 2 bảo mật) — backend so khớp với `api_key` trong payload MQTT trước khi lưu DB | `src/mqtt/subscriber.js`, firmware |

**Phía firmware** (`firmware/esp32_airiq.ino`) khai báo lại các giá trị tương ứng dưới dạng
hằng số C++ (`MQTT_HOST`, `MQTT_USER`, `MQTT_PASS`, `MQTT_TOPIC`, `DEVICE_ID`, `API_KEY`) —
phải khớp với `.env` của backend thì hệ thống mới nhận đúng dữ liệu. `MQTT_TOPIC` phía
firmware là `iot/airquality/room1` (cụ thể theo phòng), còn phía backend subscribe theo
wildcard `#` để nhận được từ mọi phòng.

## 2. Lệnh chạy project

```bash
# Backend
cd iot-backend
npm install
node server.js                 # http://localhost:3000

# Frontend (dev)
cd iot-dashboard
npm install
npm run dev                    # http://localhost:5173 (tự đổi port nếu bị chiếm)

# Frontend (build production, nếu cần)
npm run build                  # xuất ra thư mục dist/
npm run preview                # xem thử bản build production
```

## 3. Lệnh test API bằng curl

Đăng ký / đăng nhập / refresh / logout (không cần token):

```bash
# Đăng ký
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Đăng nhập — trả về { token, refreshToken }
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# Lấy access token mới từ refresh token
curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'

# Đăng xuất — thu hồi refresh token
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

Các API còn lại cần header `Authorization: Bearer <TOKEN>` (lấy từ bước đăng nhập):

```bash
TOKEN="<ACCESS_TOKEN>"

# Dữ liệu cảm biến
curl -s http://localhost:3000/api/sensor/latest  -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/sensor/data    -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3000/api/sensor/history?from=2026-07-01T00:00&to=2026-07-05T00:00" \
  -H "Authorization: Bearer $TOKEN"

# Cảnh báo
curl -s http://localhost:3000/api/alerts?resolved=false -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/alerts/stats          -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/alerts/weekly         -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH http://localhost:3000/api/alerts/<ID>/resolve -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE http://localhost:3000/api/alerts/<ID> -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "http://localhost:3000/api/alerts?resolved=false" -H "Authorization: Bearer $TOKEN"

# Ngưỡng cảnh báo
curl -s http://localhost:3000/api/settings -H "Authorization: Bearer $TOKEN"
curl -s -X PUT http://localhost:3000/api/settings -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"co2_danger":1000,"co2_warn":800}'
```

## 4. Lệnh MongoDB hữu ích (debug nhanh không cần mở Compass)

Chạy bằng Node ngay trong thư mục `iot-backend` (tự đọc `.env` sẵn có):

```bash
# Xem bản ghi cảm biến mới nhất
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const SensorData = require('./src/models/SensorData');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log(await SensorData.findOne().sort({ timestamp: -1 }));
  process.exit(0);
});
"

# Đếm số cảnh báo hiện có
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const Alert = require('./src/models/Alert');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('total:', await Alert.countDocuments({}));
  process.exit(0);
});
"

# Xóa 1 user test theo email (dọn dữ liệu sau khi test đăng ký)
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log(await User.deleteOne({ email: 'test@example.com' }));
  process.exit(0);
});
"
```

## 5. Lệnh quản lý tiến trình Node trên Windows (khi cần restart backend)

```powershell
# Tìm process node đang chạy server.js hoặc vite
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*server.js*' -or $_.CommandLine -like '*vite*' } |
  Select-Object ProcessId, CommandLine

# Dừng theo ProcessId lấy được ở trên
Stop-Process -Id <PID> -Force
```

```bash
# Sau khi dừng, chạy lại backend (từ thư mục iot-backend)
node server.js
```

## 6. Lệnh Git cơ bản cho làm việc nhóm

```bash
git clone <link-repo>
git pull                         # lấy code mới nhất trước khi bắt đầu code
git checkout -b <ten-nhanh>      # tạo nhánh riêng khi làm tính năng mới
git add <file>                   # chỉ add đúng file đã sửa, tránh add nhầm
git commit -m "mô tả ngắn gọn"
git push -u origin <ten-nhanh>
```

> Lưu ý: repo hiện chưa có `.gitignore` nên `node_modules` đang bị commit thẳng lên git —
> khi pull code mới nếu thấy xung đột (conflict) toàn ở trong `node_modules`, đó là do vấn đề
> này, không phải do bạn code sai. Xem thêm ở `HUONG_DAN_CHAY_PROJECT.md` mục 7.
