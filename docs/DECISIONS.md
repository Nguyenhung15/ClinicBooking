# CÁC QUYẾT ĐỊNH THIẾT KẾ KIẾN TRÚC P0 (ARCHITECTURE DECISIONS)

Tài liệu này ghi nhận toàn bộ các quyết định kỹ thuật nền tảng (P0 Architecture Decisions) được áp dụng trong quá trình chuyển đổi và phát triển hệ thống ClinicBooking.

---

## 1. Cơ chế Định danh (Identity & ID Format)

- **Vấn đề:** Hệ thống SQL cũ dùng số tự tăng `bigint` (MySQL), trong khi chuẩn NoSQL MongoDB dùng chuỗi `ObjectId`. Frontend có nhiều điểm kiểm tra `Number(id)` nhưng cũng có nơi truyền string. Đặc tả mới quy định: `ID là string (ObjectId), JWT userId là string, không parseInt ID. Không tin userId/role/doctorId từ client, lấy từ JWT`.
- **Mặc định đã chọn:**
  - Tầng Service, State Machine, Outbox, Audit Log và JWT Payload chuẩn hóa sử dụng **String ID** (`userId: string`, `actorId: string`, `appointmentId: string`).
  - Hỗ trợ linh hoạt: Các query tìm kiếm tài nguyên (`findOne`) chấp nhận cả `ObjectId` (hex string) lẫn `id: Number` để tương thích ngược 100% với Frontend hiện có và các bộ dữ liệu đã import từ SQL dump.
  - Tuyệt đối không dùng `parseInt(id)` trên các định danh mới.
- **Lý do:** Đảm bảo hệ thống đạt tính an toàn cao, không rủi ro tràn số nguyên JS, đồng bộ chuẩn ObjectId của MongoDB mà không phá vỡ hợp đồng dữ liệu hiện hữu với client.
- **Biến env để đổi:** Không cần biến env (mặc định chấp nhận cả 2 dạng định danh).

---

## 2. Giao dịch CSDL & Tính Nguyên tử (Atomic Operations & MongoDB Replica Set)

- **Vấn đề:** Chức năng đặt/hủy/dời lịch cần cập nhật đồng thời trạng thái Lịch hẹn (`appointments`) và Ca trực (`doctor_shifts.slots`). MongoDB chỉ hỗ trợ Multi-document ACID Transactions (`ClientSession`) khi chạy ở chế độ **Replica Set**; ở chế độ Standalone (môi trường dev cục bộ phổ biến), `session.startTransaction()` sẽ gây lỗi.
- **Mặc định đã chọn:**
  - Áp dụng kỹ thuật **Conditional Atomic Updates** làm lớp bảo vệ cốt lõi: Câu lệnh cập nhật trạng thái luôn kèm filter điều kiện hiện tại (ví dụ: `status: { $in: fromStatuses }`, `"slots.status": "AVAILABLE"`).
  - Tích hợp cờ cấu hình `ENABLE_MONGO_TRANSACTIONS`:
    + Nếu `true`: Bọc qua MongoDB Client Session Transaction.
    + Nếu `false` (mặc định trên môi trường dev/standalone): Dùng Atomic Conditional Updates kèm cơ chế **Compensation Logic** (nếu bước sau thất bại thì tự động hoàn tác bước trước và ghi nhận log bồi hoàn).
- **Lý do:** Giúp hệ thống hoạt động ổn định ngay lập tức trên máy của mọi lập trình viên và môi trường CI/CD (không bắt buộc cài đặt Replica Set), nhưng sẵn sàng kích hoạt Full ACID Transaction khi triển khai Production (MongoDB Atlas / Docker Replica Set).
- **Biến env để đổi:** `ENABLE_MONGO_TRANSACTIONS=false` (đổi sang `true` khi kết nối vào MongoDB Replica Set).

---

## 3. Múi giờ và Dịch vụ Đồng hồ Thời gian (Clock & Timezone)

- **Vấn đề:** Phòng khám hoạt động tại Việt Nam (GMT+7). Nếu server chạy trên cloud dùng UTC hoặc múi giờ khác, các thao tác so sánh ngày (`YYYY-MM-DD`), tính khoảng cách hủy lịch 24h/48h, hoặc quét lịch quá hạn có thể bị lệch ngày nếu không quản lý múi giờ tập trung.
- **Mặc định đã chọn:**
  - Cung cấp `ClockService` tập trung: Toàn bộ code nghiệp vụ gọi `clock.now()` hoặc `clock.today()` thay vì gọi trực tiếp `new Date()`. Cung cấp class `FakeClock` cho phép tua và cố định thời gian phục vụ Unit/Integration Test.
  - Mọi timestamp trong CSDL (`createdAt`, `updatedAt`, `cancelledAt`, `decidedAt`) được lưu trữ dưới dạng chuẩn **UTC**.
  - Chuỗi ngày khám (`appointmentDate`, `shiftDate`) và giờ ca khám được tính toán và chuẩn hóa theo múi giờ phòng khám: `Asia/Ho_Chi_Minh`.
- **Lý do:** Ngăn chặn triệt để lỗi lệch ngày giờ khám bệnh giữa server cloud (UTC) và bệnh nhân/bác sĩ tại Việt Nam. Cho phép kiểm thử thời gian tự động cực kỳ chính xác.
- **Biến env để đổi:** `CLINIC_TIMEZONE=Asia/Ho_Chi_Minh`.

---

## 4. Xử lý Bất đồng bộ & Mẫu Transactional Outbox (Outbox / Notification Adapter)

- **Vấn đề:** Gửi email thông báo (SMTP) hoặc đẩy tin WebSocket trực tiếp trong luồng request/response có thể làm nghẽn tiến trình, tăng độ trễ HTTP request, và nếu dịch vụ mail lỗi thì dễ làm rollback nhầm dữ liệu nghiệp vụ đã hoàn tất.
- **Mặc định đã chọn:**
  - Áp dụng mẫu kiến trúc **Transactional Outbox**: Khi một nghiệp vụ hoàn tất (commit), một bản ghi sự kiện được ghi vào collection `outbox_events` với trạng thái `PENDING`.
  - Cung cấp `OutboxService` và background worker xử lý:
    + Quét các event `PENDING`, phân phối đến các adapter (Email, WebSocket, Mock).
    + Nếu adapter lỗi mạng: Event được đánh dấu tăng số lần thử (`retries`), tính toán thời gian thử lại (Exponential Backoff), **tuyệt đối không rollback dữ liệu khám bệnh**.
    + Đảm bảo tính Idempotent: Mỗi event có `id` duy nhất, không xử lý trùng lặp.
- **Lý do:** Tách rời (decoupling) nghiệp vụ phòng khám khỏi hạ tầng mạng bên ngoài, đảm bảo trải nghiệm người dùng phản hồi tức thì và dữ liệu thông báo không bao giờ bị mất (at-least-once delivery).
- **Biến env để đổi:**
  - `OUTBOX_ENABLE_WORKER=true` (bật/tắt tiến trình nền xử lý outbox).
  - `OUTBOX_POLL_INTERVAL_MS=5000` (chu kỳ quét outbox, tính bằng mili-giây).
  - `OUTBOX_MAX_RETRIES=5` (số lần thử lại tối đa trước khi đánh dấu `FAILED`).

---

## 5. Chuẩn hóa Phản hồi Lỗi (Unified Error Envelope)

- **Vấn đề:** Các lỗi từ tầng database (Mongoose), validation, middleware xác thực, và nghiệp vụ nếu trả về nhiều cấu trúc khác nhau sẽ khiến client khó bắt lỗi, đồng thời có nguy cơ lộ stack trace ra môi trường production.
- **Mặc định đã chọn:**
  - Mọi lỗi trả về theo cấu trúc chuẩn:
    ```json
    {
      "success": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Thông báo lỗi chi tiết",
        "details": [],
        "traceId": "req-1730419200000-xxxx"
      },
      "message": "Thông báo lỗi chi tiết"
    }
    ```
  - Trường `message` top-level được giữ lại để tương thích 100% với Axios interceptors hiện hữu của `web/`.
  - Không bao giờ trả `stack` khi `NODE_ENV === 'production'`.
  - Map mã HTTP status code chuẩn: `400` (Validation/Bad Request), `401` (Unauthorized), `403` (Forbidden/Role Denied), `404` (Not Found), `409` (Conflict/State Violation), `429` (Rate Limited), `500` (Internal Error).
- **Lý do:** Giúp việc debug có traceId theo dõi, bảo mật an toàn thông tin hệ thống và frontend dễ dàng hiển thị thông báo.
- **Biến env để đổi:** `NODE_ENV=development` hoặc `NODE_ENV=production`.

---

## 6. Phân quyền Deny-by-default & Principal Extraction

- **Vấn đề:** Nếu không quản lý tập trung, lập trình viên có thể quên gắn middleware kiểm tra quyền, dẫn đến lỗ hổng bảo mật truy cập trái phép.
- **Mặc định đã chọn:**
  - Nguyên tắc **Deny-by-default**: Cung cấp middleware/guard `@Roles(...)` / `requireRoles(...)` chặn toàn bộ truy cập không có role hợp lệ.
  - Helper `getPrincipal(req)`: Trả về đối tượng `{ userId: string, role: string, email: string }` lấy trực tiếp từ JWT verified payload. Mọi controller/service lấy thông tin người gọi qua helper này, không đọc từ body.
- **Lý do:** Tuân thủ nguyên tắc Least Privilege (Đặc quyền tối thiểu) và chuẩn OWASP.
- **Biến env để đổi:** `JWT_SECRET`, `JWT_EXPIRES_IN`.

---

## 7. Giới hạn Tần suất (Rate Limiting)

- **Vấn đề:** Cần bảo vệ hệ thống khỏi tấn công DDoS, spam đặt chỗ hoặc brute-force mật khẩu.
- **Mặc định đã chọn:**
  - Cung cấp middleware `createRateLimiter({ windowMs, maxRequests, keyGenerator })` tái sử dụng được.
  - Định danh rate limit ưu tiên theo `userId` (nếu đã đăng nhập) hoặc theo `clientIp` (nếu là khách).
  - Tự động gắn response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
  - Khi vượt ngưỡng: Trả lỗi chuẩn HTTP `429 Too Many Requests` với code `RATE_LIMIT_EXCEEDED`.
- **Lý do:** Tự chủ trong mã nguồn, nhẹ nhàng, không phụ thuộc bắt buộc vào Redis trong giai đoạn P0 nhưng thiết kế giao diện adapter sẵn sàng cắm Redis khi scale.
- **Biến env để đổi:**
  - `RATE_LIMIT_WINDOW_MS=60000` (mặc định: 1 phút).
  - `RATE_LIMIT_MAX=100` (mặc định: 100 requests / phút).

---

## 8. Quản lý Cấu hình Tập trung (ConfigService)

- **Vấn đề:** Đọc trực tiếp `process.env` rải rác trong code dễ dẫn đến lỗi chính tả, thiếu giá trị mặc định và thiếu ép kiểu (`boolean`, `number`).
- **Mặc định đã chọn:**
  - Xây dựng `ConfigService` có kiểu dữ liệu rõ ràng, tự động validate các biến bắt buộc, cung cấp giá trị mặc định an toàn cho môi trường development/test.
- **Lý do:** Giúp khởi động ứng dụng an toàn (fail-fast nếu thiếu biến quan trọng), code sạch sẽ và dễ mock trong unit test.
- **Biến env để đổi:** Khai báo đầy đủ trong `.env.example`.
