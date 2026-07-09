# Kịch bản bảo vệ đồ án — AirIQ (Hệ thống giám sát chất lượng không khí IoT)

> Dùng file này để **nói theo** khi bảo vệ. Đánh dấu ☐ → ☑ sau khi luyện tập xong từng phần.
> Tổng thời gian gợi ý: **10–12 phút trình bày + 3–5 phút demo + trả lời câu hỏi**.

---

## 0. Chuẩn bị trước giờ bảo vệ (làm trước 15 phút)

- [ ] Mở sẵn 4 thứ theo đúng thứ tự tab để không mất thời gian tìm:
  1. Terminal 1: `cd iot-backend && node server.js` — **chạy sẵn**, chờ thấy đủ 4 dòng log
     (`MongoDB connected!` / `Server running on port 3000` / `MQTT connected!` / `Subscribed to iot/airquality/# (QoS 1)`).
  2. Terminal 2: `cd iot-dashboard && npm run dev` — **chạy sẵn**.
  3. Trình duyệt tab 1: `http://localhost:5173` (dashboard) — đăng nhập sẵn.
  4. Trình duyệt tab 2: link Wokwi project — **chưa bấm Start**, để bấm live cho thầy thấy lúc demo.
- [ ] Có Terminal 3 trống để gõ lệnh `curl` demo bảo mật (xem mục 5).
- [ ] Kiểm tra mạng nơi bảo vệ **không chặn cổng 8883** (một số mạng trường học chặn) —
      nếu chặn thì vẫn demo được vì backend + dashboard không cần Wokwi chạy mới xem được
      dữ liệu cũ, chỉ mất phần "dữ liệu realtime đổi theo thời gian thực".
- [ ] Chỉ **một mình bạn** chạy Wokwi lúc demo — nếu bạn cùng nhóm cũng đang mở project sẽ
      bị lẫn dữ liệu (`device_id` giống nhau).

---

## 1. Mở đầu — Giới thiệu đề tài (khoảng 1 phút)

> *"Em xin trình bày đồ án: **AirIQ — Hệ thống giám sát chất lượng không khí IoT**.
> Đây là một hệ thống IoT full-stack hoàn chỉnh: thiết bị ESP32 đo nhiệt độ, độ ẩm, nồng độ
> CO₂ trong phòng, gửi dữ liệu qua giao thức MQTT lên broker cloud, backend Node.js xử lý —
> lưu trữ — cảnh báo khi vượt ngưỡng, và một dashboard web hiển thị dữ liệu thời gian thực
> cho người dùng đã đăng nhập.*
>
> *Điểm em muốn nhấn mạnh trong đồ án này không chỉ là việc lấy được dữ liệu cảm biến lên
> web, mà là **bài toán bảo mật cho một hệ thống IoT thực tế** — cụ thể là bảo mật ở tầng
> đường truyền (transport) và tầng ứng dụng (application), đúng với nội dung học phần."*

Nói xong câu này thì chuyển sang sơ đồ kiến trúc — đừng demo ngay, thầy cần hiểu bức tranh
tổng thể trước.

---

## 2. Kiến trúc & luồng dữ liệu (khoảng 2 phút)

Vẽ tay hoặc chỉ vào slide sơ đồ này, đọc theo chiều mũi tên:

```
ESP32 (DHT22 đo nhiệt/ẩm + biến trở giả lập CO₂)
   │  đo mỗi 5 giây, đóng gói JSON {device_id, api_key, temperature, humidity, co2}
   ▼
MQTT publish qua TLS (mqtts://, cổng 8883) ──► HiveMQ Cloud (broker) ──► topic "iot/airquality/room1"
   ▼
Backend Node.js subscribe topic "iot/airquality/#"
   │  1) Kiểm tra api_key có đúng không
   │  2) Lưu vào MongoDB (collection SensorData)
   │  3) So sánh với ngưỡng cảnh báo → sinh Alert nếu vượt (có cơ chế chống spam)
   ▼
REST API (Express, xác thực JWT, giới hạn tốc độ request)
   ▲
   │ Dashboard gọi API mỗi 5 giây để lấy dữ liệu mới
Dashboard Vue 3 (gauge tròn, biểu đồ, thống kê cảnh báo) — chỉ xem được sau khi đăng nhập
```

**Câu nói chuyển ý:** *"Ba khối chính là Firmware — Backend — Frontend, em sẽ nói nhanh mỗi
khối làm gì, rồi đi sâu vào phần bảo mật vì đây là trọng tâm đồ án."*

---

## 3. Ba khối chức năng (khoảng 2 phút — nói nhanh, không đi sâu code)

### 3.1 Firmware (`firmware/esp32_airiq.ino`)
- Mô phỏng trên **Wokwi** (không cần phần cứng thật): DHT22 đo nhiệt/ẩm, biến trở giả lập CO₂
  (map điện áp 0–3.3V → 400–5000ppm).
- Tự kết nối lại WiFi/MQTT khi mất kết nối; đọc DHT22 có retry 3 lần vì cảm biến mô phỏng hay
  đọc trượt.
- Gửi dữ liệu **mỗi 5 giây** qua MQTT.

### 3.2 Backend (`iot-backend/`)
- Node.js + Express + MongoDB.
- MQTT subscriber: nhận dữ liệu, xác thực, lưu DB, so ngưỡng, sinh cảnh báo.
- REST API: đăng nhập/đăng ký, lấy dữ liệu cảm biến, quản lý cảnh báo, cài đặt ngưỡng.

### 3.3 Frontend (`iot-dashboard/`)
- Vue 3 + Vite, SPA 5 tab: Dashboard / Lịch sử / Cảnh báo / Thiết bị / Cài đặt.
- Gauge tròn theo mức good/warning/critical, mini-chart xu hướng, xuất CSV.
- Tự refresh token, tự đăng xuất sau 1 giờ không hoạt động.

> Nói xong phần này chuyển thẳng: *"Bây giờ em đi vào phần trọng tâm — bảo mật hệ thống."*

---

## 4. Trọng tâm: Ba lớp bảo mật (khoảng 4–5 phút — phần quan trọng nhất)

Đây là phần thầy sẽ hỏi nhiều nhất, nói **chậm và rõ ràng** từng lớp, giải thích **tại sao
cần** trước khi nói **làm thế nào**.

### Bối cảnh (nói trước để thầy hiểu vì sao phải chia 3 lớp)
> *"HiveMQ Cloud bản Free chỉ cấp **một cặp username/password MQTT duy nhất** cho cả hệ
> thống, nên không thể cấp riêng credential cho từng thiết bị ở tầng broker như mô hình
> lý tưởng. Vì vậy em thiết kế bù lại bằng 3 lớp bảo mật độc lập, mỗi lớp chặn một loại
> tấn công khác nhau."*

### Lớp 1 — Bảo mật đường truyền MQTT (Transport Security)
- Firmware kết nối broker qua **TLS** (`mqtts://`, cổng 8883), dùng `WiFiClientSecure.setCACert()`
  với root CA thật (Let's Encrypt ISRG Root X1) để **xác thực chứng chỉ của broker**.
- **Vì sao quan trọng:** nếu không xác thực chứng chỉ (dùng `setInsecure()`), thiết bị có thể
  bị tấn công **man-in-the-middle (MITM)** — kẻ tấn công giả làm broker để đọc/sửa dữ liệu.
  Đây đúng là nội dung "bảo mật tầng mạng" trong tài liệu học phần.
- Ngoài TLS, kết nối còn yêu cầu username/password cấp broker — chặn client lạ không có
  credential không publish/subscribe được.

### Lớp 2 — Xác thực thiết bị ở tầng ứng dụng (Device API Key)
- Vì mọi thiết bị dùng chung 1 credential MQTT (hạn chế của gói Free), **không thể chỉ tin
  vào lớp broker**.
- Mỗi payload thiết bị gửi lên đều kèm `api_key` riêng. Backend kiểm tra khớp
  `DEVICE_API_KEY` **trước khi lưu DB** — sai key thì bị loại, không lưu.
- **Vì sao quan trọng:** đây là lớp xác thực "đúng là thiết bị hợp lệ" độc lập với lớp
  broker — nếu có ai lấy được username/password broker (vì nó dùng chung), payload của họ
  vẫn bị chặn ở đây nếu không biết `api_key`.

### Lớp 3 — Xác thực & phân quyền người dùng web (JWT + Hashing + Session hardening)
- Mật khẩu băm bằng **bcrypt** (10 salt rounds) — không lưu plaintext.
- **Access token + refresh token tách biệt**: access token sống ngắn (15 phút), refresh
  token sống 7 ngày và lưu trong DB để có thể **thu hồi** khi logout.
- Mỗi lần refresh sẽ **xoay vòng (rotate)** cấp token mới và vô hiệu hóa token cũ — giảm rủi
  ro nếu token bị lộ.
- Middleware chặn mọi route dữ liệu (`/api/sensor`, `/api/alerts`, `/api/settings`) nếu không
  có Bearer token hợp lệ.
- **Rate limiting** tách riêng: `/api/auth/*` giới hạn chặt 30 request/15 phút để **chống
  brute-force** đăng nhập; các API còn lại 120 request/phút cho đủ traffic dashboard polling.
- Tự động đăng xuất sau 1 giờ không hoạt động (idle timeout) — giảm rủi ro quên đăng xuất
  trên máy dùng chung.
- Toàn bộ response API có header `Cache-Control: no-store` — tránh dữ liệu đã xác thực bị
  cache lại ở trình duyệt/proxy trung gian.

**Câu chốt phần này:**
> *"Tóm lại: Lớp 1 chống nghe trộm/giả mạo trên đường truyền, Lớp 2 chống thiết bị giả mạo
> gửi dữ liệu bẩn vào hệ thống, Lớp 3 chống truy cập trái phép và brute-force từ phía người
> dùng web. Ba lớp độc lập nên nếu một lớp có hạn chế (như lớp broker dùng chung credential),
> hai lớp còn lại vẫn giữ được an toàn tổng thể."*

---

## 5. Demo trực tiếp cho thầy (khoảng 3–5 phút)

**Nguyên tắc demo:** đi từ **dữ liệu thật chạy end-to-end** → sau đó **chứng minh từng lớp
bảo mật hoạt động** bằng cách cho thầy thấy hệ thống **chặn** khi thiếu điều kiện.

### Bước 1 — Cho thấy dữ liệu realtime (chứng minh hệ thống chạy được)
1. Chuyển sang tab Wokwi, bấm ▶ **Start Simulation**.
2. Chỉ vào Serial Monitor, đọc dòng log: `[OK] temp=... hum=... co2=... → iot/airquality/room1`
   lặp lại mỗi 5 giây → *"đây là thiết bị đang gửi dữ liệu thật qua MQTT"*.
3. Chuyển sang tab Dashboard (đã đăng nhập sẵn), chỉ vào 3 gauge tròn đang **tự cập nhật**
   theo dữ liệu mới.
4. Xoay potentiometer trên Wokwi → chỉ vào gauge CO₂ đổi màu/giá trị theo thời gian thực
   *"đây là minh chứng luồng dữ liệu end-to-end: cảm biến → MQTT → backend → dashboard"*.

### Bước 2 — Chứng minh Lớp 3 (JWT) đang chặn truy cập trái phép
Mở Terminal 3, gõ lệnh **không kèm token**:
```bash
curl -s http://localhost:3000/api/sensor/latest
```
→ Thầy sẽ thấy trả về `{"message":"No token"}` với status 401.

Sau đó login lấy token và gọi lại **có token** để đối chứng:
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email đã đăng ký>","password":"<mật khẩu>"}'
```
Copy `token` trả về, chạy tiếp:
```bash
TOKEN="<dán access token vừa lấy>"
curl -s http://localhost:3000/api/sensor/latest -H "Authorization: Bearer $TOKEN"
```
→ Lần này trả về dữ liệu JSON thật. *"Đây là minh chứng middleware JWT hoạt động đúng —
không có token hợp lệ thì không lấy được dữ liệu, dù dữ liệu vẫn đang chảy vào hệ thống ở
tầng dưới."*

### Bước 3 — Chứng minh Lớp 2 (API key thiết bị) đang chặn dữ liệu giả mạo (tùy chọn, nếu còn thời gian)
Giải thích bằng lời (không cần thao tác MQTT client thủ công nếu không có sẵn công cụ):
> *"Nếu có ai đó biết được username/password MQTT chung và tự publish một payload không có
> `api_key` đúng, log backend sẽ in ra `Invalid API key` và bản ghi đó **không được lưu vào
> MongoDB** — em có thể chỉ dòng log này trong code `subscriber.js` dòng 25–28."*

Nếu muốn demo thật (không bắt buộc): dùng MQTT Explorer hoặc `mosquitto_pub` publish thử một
payload sai `api_key` lên đúng topic, rồi chỉ vào log backend in `Invalid API key` — dữ liệu
đó biến mất, không xuất hiện trên dashboard.

### Bước 4 — Chứng minh rate limit chống brute-force (tùy chọn, nếu thầy hỏi thêm)
```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" -d '{"email":"a@a.com","password":"wrong"}'
done
```
→ Sau request thứ 30 trong 15 phút, các request tiếp theo trả về `429` với message
`"Quá nhiều request, thử lại sau!"` — minh chứng chống brute-force đăng nhập.

> ⚠️ Chạy lệnh này **sau cùng** vì nó sẽ tự khóa tạm API đăng nhập của chính bạn trong 15
> phút — chỉ chạy khi đã demo xong các bước cần đăng nhập ở trên.

---

## 6. Câu hỏi phản biện dự kiến + gợi ý trả lời

| Câu hỏi thầy có thể hỏi | Trả lời gợi ý |
|---|---|
| Vì sao không tách credential MQTT riêng cho mỗi thiết bị? | HiveMQ Cloud gói Free chỉ cho 1 cặp credential/cluster — hạn chế hạ tầng, không phải thiết kế. Đã bù bằng lớp API key tầng ứng dụng (Lớp 2). |
| Vì sao dùng JWT mà không dùng session cookie truyền thống? | JWT stateless, phù hợp REST API tách rời frontend/backend (SPA + API riêng), dễ scale ngang không cần lưu session server-side. |
| Access token 15 phút có ngắn quá không, ảnh hưởng UX? | Không, vì có refresh token tự động ở tầng axios interceptor — người dùng không nhận ra, chỉ bị đăng xuất khi refresh token thật sự không hợp lệ/hết hạn. |
| Sao không dùng WebSocket cho realtime mà lại polling 5s? | Đây là hạn chế đã ghi nhận trong TODO — hướng phát triển tiếp theo là dùng WebSocket/SSE để đẩy dữ liệu thay vì polling, giảm tải server. |
| Mật khẩu, JWT secret, API key đang lưu ở đâu, có an toàn không? | Lưu trong `.env`/hardcode trong firmware — chấp nhận được cho môi trường học tập/demo (Wokwi project không public), nhưng ghi rõ trong tài liệu là cần xoay vòng (rotate) credential trước khi đưa lên production thật. |
| Cơ chế cooldown cảnh báo hoạt động thế nào? | Khi giá trị vượt ngưỡng liên tục qua nhiều chu kỳ đo (mỗi 5s), backend chỉ tạo 1 cảnh báo mới cho mỗi loại/thiết bị trong vòng 5 phút, tránh spam hàng chục cảnh báo giống nhau. |
| Nếu hai thiết bị cùng gửi dữ liệu thì phân biệt bằng gì? | Bằng field `device_id` trong payload — mỗi bản ghi SensorData/Alert đều gắn `deviceId`, cho phép truy vấn/lọc theo từng thiết bị riêng biệt dù chạy trên cùng broker. |
| Điểm yếu lớn nhất của hệ thống hiện tại là gì? | Trung thực trả lời theo mục "Hạn chế" dưới đây — thầy đánh giá cao sự tự nhận thức hơn là né tránh. |

---

## 7. Hạn chế & hướng phát triển (nói khi được hỏi, hoặc chủ động nói cuối bài — tạo điểm cộng)

- Credential thật (MQTT password, JWT secret, API key) đang hardcode/plaintext — cần xoay
  vòng trước khi triển khai thật, hiện chấp nhận được vì môi trường học tập.
- Email đăng ký chỉ validate **đúng định dạng**, chưa gửi mail xác nhận thật.
- Dashboard đang polling 5s, chưa dùng WebSocket/SSE để đẩy dữ liệu thật realtime.
- Chưa tách credential MQTT riêng cho từng thiết bị (do hạn tầng hạ tầng broker Free) — nếu
  lên production nên đổi sang gói broker hỗ trợ multi-credential hoặc dùng chứng chỉ client
  TLS riêng cho từng thiết bị (mutual TLS).

> *"Đây là các hướng em sẽ tiếp tục hoàn thiện nếu phát triển đồ án lên mức sản phẩm thật."*

---

## 8. Câu chốt cuối bài

> *"Tổng kết: AirIQ là một hệ thống IoT giám sát không khí hoàn chỉnh từ phần cứng đến giao
> diện web, và trọng tâm em muốn thể hiện là tư duy thiết kế bảo mật nhiều lớp cho một hệ
> thống có ràng buộc hạ tầng thực tế (broker MQTT dùng chung), thay vì chỉ dừng ở mức 'chạy
> được'. Em xin hết phần trình bày, mời thầy đặt câu hỏi."*
