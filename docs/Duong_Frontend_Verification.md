# Kiểm chứng phần Dương — 21/11/2026

Môi trường: Windows, Node 24.21.0, Next.js 16.4.6, Chrome headless. Các kết quả dưới đây được chạy trên nhánh local có frontend Sơn, auth Hải Anh/API Chúc và phần Dương.

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt |
| `npm run build` | Đạt; gồm route Việt/Anh và các URL auth cũ |
| `npm run test:ui` với Chrome | 26/26 đạt: 13 ca hàng đợi, 13 ca form/auth integration routes |
| `npm run test:reporter-flow` | 7 nhóm kiểm tra đạt với PostgreSQL 17.12 độc lập |

## Giao diện

Đã kiểm tra gửi đúng payload không cần gợi ý, bấm nhanh chỉ gửi một request, giữ nguyên khoảng trắng/xuống dòng trong mô tả, hiển thị mã xác nhận, tọa độ đi cặp, xóa lựa chọn con khi đổi tòa, chặn mô tả toàn khoảng trắng, nội dung gợi ý được render thành text, lý do Việt/Anh, không biểu diễn score thành phần trăm, AI lỗi vẫn gửi được, bỏ response cũ, response sai cấu trúc không hiện như gợi ý hợp lệ, phiên hết hạn vẫn giữ bản nháp, không retry tự động request tạo báo cáo, tải lại danh mục, danh mục rỗng và màn mobile không tràn ngang.

Test UI dùng dữ liệu mô phỏng tại browser để kiểm tra các nhánh trạng thái. Các ca này không tự chứng minh phân quyền hoặc giao dịch DB.

## Luồng xuyên suốt không mô phỏng API web

Script `check-reporter-flow.mjs` chạy production build, PostgreSQL 17.12 từ `embedded-postgres`, các migration và seed thật của repo, Better Auth và Prisma thật:

1. Khách chưa đăng nhập gọi danh mục nhận 401.
2. Đăng nhập tài khoản thử qua giao diện login thật thành công.
3. Form lấy danh mục từ DB; Next.js lấy ứng viên thật và gọi upstream fixture, UI hiển thị gợi ý đúng.
4. Tắt upstream: UI báo không khả dụng; vẫn gửi được. DB chứa đúng một Report, Issue SUBMITTED và REPORT_SUBMITTED event liên quan đến ID vừa trả, đúng người gửi và mô tả.
5. Tài khoản quản lý đăng nhập, mở hàng đợi Sơn và thấy báo cáo vừa tạo qua form Dương.
6. REPORTER/STAFF không đọc được hàng đợi quản lý; STAFF được đọc danh mục để báo sự cố.
7. Đăng xuất làm request danh mục tiếp theo nhận 401; không có lỗi JavaScript không được xử lý trên trang báo cáo.

Các tài khoản thử được seed với email đã xác minh, mật khẩu băm và mật khẩu ngẫu nhiên chỉ tồn tại trong tiến trình; đây không phải kiểm thử phát thư/xác minh email. Auth vẫn dùng endpoint đăng nhập và session thật, không có bypass auth trong sản phẩm.

Ảnh sau test: `test-results/reporter-flow/desktop.png`, `test-results/reporter-flow/mobile.png`. Các ảnh dùng danh mục và báo cáo seed thật, gợi ý từ AI fixture. Đã đọc ảnh desktop 1440px và mobile 390px.

## Giới hạn

- Chưa chạy mô hình FastAPI thật trong lượt kiểm chứng này; không tuyên bố chất lượng xếp hạng, embedding hoặc SLA.
- Chưa kiểm thử Safari/iOS thật, SMTP ngoài, HTTPS production hoặc nhiều người dùng đồng thời.
- Chưa triển khai upload, theo dõi, merge/unmerge hoặc luồng sửa chữa đầy đủ.
- Những giới hạn sẵn có của hàng đợi Sơn (bộ lọc/ phân trang) được ghi trong tài liệu bàn giao.
