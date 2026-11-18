# API báo cáo của Chúc

Chạy từ thư mục gốc với Node 24 theo README. Sao chép `.env.example` thành `.env` khi thiết lập lần đầu. Khởi động DB, áp dụng migration và tạo các tài khoản mẫu.

```powershell
npm.cmd ci
docker compose -f database-starter/compose.database.yaml up -d --wait db
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:seed
```

Trong PowerShell, tạo mật khẩu demo riêng cho từng vai và khởi động web.

```powershell
$env:VASTFIX_DEMO_AUTH = '1'
$env:VASTFIX_DEMO_REPORTER_PASSWORD = [guid]::NewGuid().ToString('N')
$env:VASTFIX_DEMO_STAFF_PASSWORD = [guid]::NewGuid().ToString('N')
$env:VASTFIX_DEMO_MANAGER_PASSWORD = [guid]::NewGuid().ToString('N')
npm.cmd run dev
```

Để thử API bằng script bên dưới, chạy web trong cửa sổ con kế thừa các biến môi trường (ví dụ chạy `Start-Process powershell -ArgumentList '-NoExit','-Command','npm.cmd run dev'` thay cho dòng cuối). Giữ cửa sổ ban đầu để chạy kiểm thử.

```powershell
node --env-file=.env scripts/check-report-api.mjs
```

Script dùng DB phát triển đã seed và để lại các báo cáo thử để nhóm xem trong hàng đợi. Nó kiểm tra HTTP, quan hệ Report–Issue, danh tính người gửi và nhật ký trong DB bằng cùng DATABASE_URL với web.

### Phiên demo

Gọi `POST /api/dev/session` với JSON gồm `email` và `password`. Ba email seed là `reporter@demo.invalid`, `staff@demo.invalid`, `manager@demo.invalid`. Client giữ cookie HttpOnly cho các request tiếp theo. `DELETE /api/dev/session` thu hồi phiên. Phiên hết hạn sau một giờ. Backend đọc lại vai từ PostgreSQL mỗi request. Chế độ này chỉ dùng trong development trên loopback với cờ bật tường minh. Xác minh email USTH là phần tích hợp sau.

### API nghiệp vụ

- `POST /api/reports` nhận `description` (tối đa 5000 đơn vị UTF-16), `location` và tùy chọn `proposedCategoryCode`. Các ID trong nhà phải thuộc đúng cây vị trí. Ngoài trời cần mô tả vị trí và có thể gửi thêm một cặp tọa độ. Kết quả thành công là HTTP 201.
- `GET /api/manager/issues?status=SUBMITTED` trả 25 phiếu mỗi trang, mới nhất trước. Khi có `nextCursor`, truyền giá trị này vào tham số `cursor` của lần gọi tiếp. Chỉ quản lý đã đăng nhập được đọc.

### Gợi ý báo cáo trùng

`POST /api/duplicate-suggestions` nhận cùng JSON và dùng cùng phiên với `POST /api/reports`. Next.js gửi ứng viên tới `POST /duplicates` trên `FASTAPI_BASE_URL` (mặc định http://127.0.0.1:8000). Đặt URL nội bộ do Thành Lê cung cấp trong môi trường của web. Sau khi lấy code, chạy `npm run db:generate`, `npm run db:deploy` rồi khởi động lại web.

Cấu hình pilot dùng tối đa 50 ứng viên (đổi bằng `DUPLICATE_CANDIDATE_LIMIT`). Trong nhà lấy theo thứ tự cùng khu vực, cùng tầng, cùng tòa, mới nhất trong mỗi nhóm. Ngoài trời lấy vị trí có cùng mô tả không phân biệt hoa thường hoặc có chênh lệch tối đa 0,001 độ theo mỗi trục tọa độ. Đây là lựa chọn ban đầu để nhóm đánh giá. Dịch vụ AI chọn ứng viên phù hợp và trả tối đa 5 gợi ý. Timeout mặc định là 5000 ms (`DUPLICATE_TIMEOUT_MS`).

#### Kiểm thử trong Git Bash

Dùng DB phát triển đã migrate và seed. Script tạo các phiếu thử, đóng một phiếu và gộp một phiếu thử vào phiếu thử khác. Chạy từ thư mục VastFix-Chuc với các mật khẩu demo trong .env.local. Nếu đã có một Next dev đang chạy trong cùng thư mục, dừng bằng Ctrl+C trước.

Tab 1:

```bash
FASTAPI_BASE_URL=http://127.0.0.1:18319 DUPLICATE_TIMEOUT_MS=500 npm run dev -- -p 3319
```

Tab 2:

```bash
node --env-file=.env --env-file=.env.local scripts/check-duplicates.mjs
```

Script mở dịch vụ thử trên cổng 18319, kiểm tra hợp đồng HTTP và đóng cổng khi hoàn tất. Để thử với AI của nhóm, khởi động lại web với FASTAPI_BASE_URL của service thật và timeout pilot.
