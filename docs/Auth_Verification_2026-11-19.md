# Kiểm chứng nền xác thực - 19/11/2026

Đã chạy trên DB riêng `vastfix_auth_review_20261119`, Next.js cổng 3320 và Mailpit local. Không gửi email ra hộp thư USTH thật.

| Ca | Kết quả |
| --- | --- |
| Email ngoài tên miền USTH | Bị từ chối. |
| Body đăng ký tự đặt role=MANAGER và emailVerified=true | User trong DB vẫn là REPORTER, chưa xác minh. |
| Mật khẩu trong DB | Có giá trị băm, khác mật khẩu đã nhập. |
| Chưa đăng nhập gọi /api/me | 401. |
| Đăng nhập trước xác minh | 403. |
| Email xác minh | Đến đúng người nhận thử trong Mailpit. |
| Bấm liên kết | Email được đánh dấu đã xác minh; quay về trang đăng nhập. |
| Đăng nhập sau xác minh | Thành công; /api/me nhận đúng User. |
| Reporter mở hàng đợi quản lý | 403. |
| Reporter gửi báo cáo | 201; reporterId trong DB đúng User của phiên. |
| Khởi tạo quản lý đầu tiên | Thành công, có UserRoleEvent. |
| Dùng phiên cũ sau thay đổi vai | Backend dùng vai mới trong DB. |
| Đăng xuất hoặc đặt hết hạn phiên | Phiên cũ gọi /api/me nhận 401. |
| Build và kiểm tra TypeScript | Đạt. |
| API demo cũ của Chúc khi bật tường minh trong development | Script check-report-api.mjs vẫn đạt. |
| Nâng cấp DB phát triển của Hải Anh | Migration đã áp dụng; số dòng và dấu kiểm tra toàn bộ nội dung Report, Issue, IssueEvent trước/sau khớp hoàn toàn (mỗi bảng 2 dòng ở thời điểm kiểm tra). |

Script tái lập: `node --env-file=.env scripts/check-auth.mjs`. Dùng môi trường thử riêng; script tạo User/Report thử và chỉ cho phép SMTP local Mailpit. Không đưa mật khẩu hoặc cookie của test vào báo cáo.

Phần chưa xác nhận: phát thư tới nhà cung cấp email thật, triển khai HTTPS/domain production, giao diện cấp vai và quên mật khẩu. Bộ kiểm chứng này không thay kết quả cuối kỳ hoặc xác nhận các cấu hình SMTP bên ngoài.
