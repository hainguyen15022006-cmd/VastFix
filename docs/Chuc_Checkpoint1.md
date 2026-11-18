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
