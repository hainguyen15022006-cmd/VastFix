# Hải Anh - tự chạy và hiểu phần đăng nhập

## 1. Ba khái niệm cần biết

- **Better Auth:** thư viện xử lý đăng ký, mật khẩu, phiên đăng nhập và liên kết xác minh.
- **SMTP:** giao thức ứng dụng dùng để chuyển thư tới máy chủ email.
- **Mailpit:** máy chủ nhận email thử trên máy, có giao diện hộp thư tại `http://127.0.0.1:8025`. Không chuyển thư tới hộp thư USTH thật. Nhóm dùng nó để kiểm tra quy trình trước khi có dịch vụ gửi thư.

Trong môi trường thử: nhập địa chỉ thử thuộc `@usth.edu.vn` -> ứng dụng gửi thư vào Mailpit -> mở Mailpit và bấm xác minh -> đăng nhập. Điều này kiểm tra cơ chế xác minh trong ứng dụng; khi vận hành thật, thư phải được chuyển tới hộp thư do người dùng sở hữu qua dịch vụ gửi email được cấu hình.

## 2. Bản chuẩn bị gồm những gì?

- Nhánh `feat/auth-foundation`, dựa trên backend Chúc đã được sửa ở `e5ebe19`.
- Thêm thông tin xác minh vào User; thêm Session, Account, Verification và nhật ký UserRoleEvent bằng migration mới.
- Trang `/register`, `/login`, `/account` và endpoint `/api/me`.
- User tự đăng ký nhận REPORTER; client không đặt được vai hoặc tự xác minh email.
- Mật khẩu được Better Auth băm trước khi lưu; không lưu mật khẩu thô trong User.
- Các API nghiệp vụ nhận phiên thật, lấy lại vai hiện hành từ DB, yêu cầu email đã xác minh.
- Cơ chế demo của Chúc được giữ để thử tích hợp khi bật tường minh trên development/loopback; cấu hình mới mặc định tắt bằng `VASTFIX_DEMO_AUTH=0`.

## 3. Vào đúng repo

Trên máy Hải Anh:

```bash
cd /Users/anhnh/VastFix
git branch --show-current
```

Nhánh cần thấy: `feat/auth-foundation`. Các lệnh tiếp theo chạy ở gốc repo.

## 4. Cài thư viện và tạo cấu hình riêng

```bash
npm ci
npm run auth:setup
```

Lệnh setup tạo/bổ sung `.env` và sinh BETTER_AUTH_SECRET ngẫu nhiên. Không đưa `.env` lên Git hoặc gửi secret vào nhóm. Lệnh giữ các giá trị đã có, không tự đổi DB hoặc SMTP đã cấu hình.

Kiểm tra BETTER_AUTH_URL trong `.env` khớp địa chỉ dùng trên trình duyệt, mặc định `http://127.0.0.1:3000`. Tránh dùng lẫn localhost với 127.0.0.1 vì cookie và kiểm tra nguồn yêu cầu phải cùng địa chỉ. Nếu đổi cổng web, đổi URL rồi khởi động lại server.

## 5. Chạy PostgreSQL và hộp thư thử

Mở Docker Desktop, rồi chạy:

```bash
docker compose -f database-starter/compose.database.yaml up -d db
docker compose -f compose.mail.yaml up -d
```

PostgreSQL vẫn dùng volume trước đó. Mailpit mở SMTP ở cổng 1025 và giao diện xem thư ở 8025, chỉ bind loopback. Không cần đăng ký dịch vụ email bên ngoài cho bước thử này.

## 6. Áp dụng migration và sinh code Prisma

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run db:verify
```

Migration bổ sung bảng/trường, không xóa Report, Issue hoặc nhật ký cũ. Ba User `@demo.invalid` chỉ là fixture, không tự có mật khẩu đăng nhập thật. Không đổi chúng thành tài khoản thật; hãy đăng ký tài khoản mới ở bước 8.

## 7. Mở ứng dụng

Dừng server cũ bằng Ctrl+C nếu bạn đang chạy nó trong Terminal. Sau đó:

```bash
npm run dev
```

Mở `http://127.0.0.1:3000/register`. Nếu cổng bận, dừng bản web cũ hoặc chọn cổng khác và cập nhật BETTER_AUTH_URL cho khớp; không chỉ mở nhầm cổng mà giữ URL xác minh cũ.

## 8. Tự thử đăng ký và xác minh

1. Nhập họ tên, một địa chỉ thử có đuôi `@usth.edu.vn`, mật khẩu từ 12 đến 128 ký tự. Khi dùng Mailpit, không nhập mật khẩu email USTH; đây là mật khẩu riêng cho tài khoản VastFix.
2. Bấm đăng ký. Thông báo yêu cầu kiểm tra thư xuất hiện.
3. Nếu đăng nhập trước khi xác minh, ứng dụng phải từ chối.
4. Mở `http://127.0.0.1:8025`, tìm thư VastFix gửi cho địa chỉ vừa nhập.
5. Bấm liên kết xác minh; trở về trang đăng nhập.
6. Đăng nhập bằng tài khoản và mật khẩu vừa tạo.
7. Trang `/account` phải hiện đúng họ tên/email, vai “Người báo sự cố” và trạng thái đã xác minh.
8. Bấm đăng xuất; mở lại `/account` phải được đưa về trang đăng nhập.

Link xác minh hết hạn sau 1 giờ. Phiên đăng nhập có thời hạn cấu hình 8 giờ, được cập nhật theo chính sách Better Auth khi người dùng hoạt động. Có thể gửi lại thư từ trang đăng nhập. Nếu nhấn link cũ/hết hạn và không đăng nhập được, yêu cầu thư mới.

## 9. Kiểm tra quyền và kết nối API Chúc

Sau đăng nhập, mở `http://127.0.0.1:3000/api/me` để xem người dùng mà backend nhận diện. Nó trả JSON có User và requestId; thiếu phiên trả 401. Vai REPORTER gọi hàng đợi quản lý nhận 403. Các API báo cáo và gợi ý giữ request/response nghiệp vụ đã chốt, chỉ đổi cách nhận phiên.

Better Auth tự xử lý `/api/auth/*` theo định dạng response của thư viện. Đây là nhóm endpoint xác thực mới, không dùng envelope lỗi của API nghiệp vụ. Những API nghiệp vụ như `/api/reports`, `/api/manager/issues` và `/api/me` vẫn dùng `error.code`, `error.message`, `requestId` theo quy ước nhóm.

Để khởi tạo **quản lý đầu tiên**, người vận hành DB chạy lệnh sau với tài khoản đã đăng ký và xác minh:

```bash
npm run auth:bootstrap-manager -- email-cua-ban@usth.edu.vn
```

Thay bằng email thật của tài khoản VastFix bạn vừa tạo. Lệnh chỉ chạy khi chưa có quản lý đã xác minh, cập nhật vai và ghi UserRoleEvent trong cùng giao dịch. Đây là thao tác có quyền của người vận hành, không phải chức năng để người dùng tự cấp vai. Tài khoản quản lý đã tồn tại thì lệnh sẽ từ chối; giao diện/API quản lý cấp vai tiếp theo chưa được triển khai trong bước nền này.

## 10. Tệp nào cần đọc trước?

| File | Mục đích |
| --- | --- |
| `src/lib/auth.ts` | Better Auth, bắt xác minh email, giới hạn tên miền, vai do server gán. |
| `src/lib/email.ts` | Chuyển thư tới SMTP đã cấu hình; hiện dùng Mailpit. |
| `src/lib/current-user.ts` | API nhận phiên thật, đọc quyền hiện hành từ DB, hỗ trợ demo có điều kiện. |
| `src/app/api/auth/[...all]/route.ts` | Chuyển request xác thực tới Better Auth. |
| `src/app/api/me/route.ts` | Xem danh tính mà backend nhận diện. |
| `src/components/auth-form.tsx` | Form đăng ký/đăng nhập/gửi lại xác minh. |
| `database-starter/prisma/migrations/20261119000000_better_auth/` | Thay đổi cấu trúc DB cho xác thực. |

## 11. Kiểm tra tự động và giới hạn hiện tại

Trong môi trường thử riêng với Mailpit, chạy `node --env-file=.env scripts/check-auth.mjs` khi app đang chạy đúng BETTER_AUTH_URL. Script tạo tài khoản thử và dữ liệu thử; không dùng như tác vụ trên DB vận hành. Nó chỉ cho chạy khi SMTP trỏ tới Mailpit local.

Đã có ca kiểm tra tên miền, chặn client nâng vai/tự xác minh, mật khẩu được băm, thư tới Mailpit, đăng nhập trước/sau xác minh, tạo Report đúng người gửi, quyền quản lý, bootstrap có nhật ký, thu hồi vai, đăng xuất và hết hạn phiên. Xem bản kiểm chứng đi kèm để phân biệt các ca đã chạy với tính năng còn thiếu.

Chưa cấu hình SMTP gửi tới email thật; chưa làm giao diện cấp vai, quên mật khẩu, chỉnh tài khoản hoặc trải nghiệm sản phẩm cuối cùng. Khi triển khai thật cần domain/HTTPS và dịch vụ SMTP có TLS; cấu hình gửi thư production yêu cầu TLS. Bộ này là nền đăng nhập có thể tích hợp để nhóm tiếp tục phát triển.

Tham khảo: [Better Auth + Next.js](https://better-auth.com/docs/integrations/next), [Prisma adapter](https://better-auth.com/docs/adapters/prisma), [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/).
