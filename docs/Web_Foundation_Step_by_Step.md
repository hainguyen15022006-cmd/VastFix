# Hải Anh - từng bước chạy khung Next.js kết nối PostgreSQL

## Mục tiêu và vị trí các phần

Chạy ứng dụng web trên máy và thấy web đọc được dữ liệu seed trong PostgreSQL. Bước này chưa làm đăng nhập hoặc API báo cáo của Chúc.

Ứng dụng Next.js nằm ở **gốc repo**. Schema, migration và seed tiếp tục ở `database-starter/`, chỉ có một bản schema dùng chung. Bộ database-starter vẫn có thể chạy riêng như trước; khi làm web, dùng các lệnh tại gốc repo bên dưới.

```text
VastFix/
  package.json                 Lệnh chạy web và DB từ gốc repo
  package-lock.json            Phiên bản thư viện của ứng dụng chung
  .env                         Kết nối DB trên máy này, không đưa lên Git
  src/
    app/page.tsx               Trang đầu
    app/dev/database/page.tsx  Trang kiểm tra số bản ghi, chỉ khi development
    app/api/health/route.ts    Kiểm tra server kết nối được DB
    lib/db.ts                  Prisma Client chỉ dùng phía server
  database-starter/
    prisma/schema.prisma      Các bảng và quan hệ
    prisma/migrations/        Lịch sử cấu trúc DB
    prisma/seed.ts            Dữ liệu mẫu
    generated/                Prisma Client được sinh, không đưa lên Git
  docs/                       ERD, API contract và Auth/RBAC
```

## Bước 1 - Mở đúng repo và nhánh

Mở Terminal, chạy từng dòng:

```bash
cd /Users/anhnh/VastFix
git branch --show-current
node --version
```

Trên máy Hải Anh, nhánh chuẩn bị khung web là `feat/web-foundation`. Node.js dùng dòng 24, tối thiểu 24.11. Đây là đường dẫn repo thật, khác workspace tài liệu `Documents/ChatGPT/Vastfix` dùng trước đó.

## Bước 2 - Cài thư viện của ứng dụng web

```bash
npm ci
```

Chạy ở **gốc repo**, nơi có package.json của Next.js. `npm ci` đọc lockfile để cài đúng phiên bản. Không cần chạy `create-next-app` thêm vì khung và các file cấu hình đã được chuẩn bị. Next.js và React là phần web; Prisma và pg là phần kết nối DB; TypeScript kiểm tra kiểu dữ liệu.

## Bước 3 - Chuẩn bị cấu hình DB cho web

```bash
cp -n .env.example .env
```

File mẫu ở gốc repo dùng cùng DB phát triển ở `localhost:5433` như Compose. `cp -n` chỉ tạo khi chưa có file. Nếu đã có `.env` với cấu hình khác, kiểm tra cho khớp trước khi chạy migration/seed.

Next.js đọc `.env` tại gốc ứng dụng. File `.env` trong `database-starter/` phục vụ các lệnh khi chạy riêng từ thư mục đó, không tự được dùng làm cấu hình cho web ở gốc. Không thêm tiền tố `NEXT_PUBLIC_` cho DATABASE_URL vì trình duyệt không được nhận thông tin kết nối DB.

## Bước 4 - Mở PostgreSQL

Mở Docker Desktop, đợi engine chạy. Từ gốc repo:

```bash
docker compose -f database-starter/compose.database.yaml up -d db
docker compose -f database-starter/compose.database.yaml ps
```

Đợi DB hiện `healthy`. Vẫn là Compose project `vastfix-local-db`, nên dùng lại volume dữ liệu đã tạo; không tạo bộ DB mới. Không dùng lệnh xóa volume để xử lý lỗi thông thường.

## Bước 5 - Kiểm tra và chuẩn bị dữ liệu

Chạy từng lệnh; nếu có lỗi thì xử lý trước khi chạy lệnh tiếp:

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:verify
```

- Validate: schema hợp lệ.
- Generate: sinh Prisma Client để code web đọc DB.
- Deploy: áp dụng migration đã có; nếu DB đã cập nhật thì không tạo lại bảng.
- Seed: nạp bộ dữ liệu mẫu theo ID cố định.
- Verify: xác nhận mẫu Report-Issue-nhật ký có đủ quan hệ.

## Bước 6 - Chạy ứng dụng

```bash
npm run dev
```

Giữ Terminal này chạy. Mở địa chỉ Next.js hiển thị, mặc định `http://127.0.0.1:3000`.

Trang đầu phải có tiêu đề VastFix và liên kết “Mở trang kiểm tra DB”. Bấm liên kết đó hoặc mở `http://127.0.0.1:3000/dev/database`.

Trang kiểm tra phải báo đọc được 8 bảng. Với DB chỉ có bộ seed ban đầu, số liệu là:

| Bảng | Số mẫu |
| --- | --- |
| User | 3 |
| Building | 1 |
| Floor | 1 |
| Area | 1 |
| Category | 1 |
| Report | 2 |
| Issue | 2 |
| IssueEvent | 2 |

Nếu đã thêm dữ liệu khác thì tổng có thể cao hơn. Trang này chỉ hiển thị số bản ghi, không hiển thị danh tính hay nội dung báo cáo. Dữ liệu được truy vấn khi mở/tải lại trang, không phải số mẫu viết cố định trong giao diện.

## Bước 7 - Kiểm tra đường kết nối bằng endpoint health

Trong khi server đang chạy, mở `http://127.0.0.1:3000/api/health`. Kết quả mong đợi:

```json
{ "status": "ok", "database": "ok" }
```

Endpoint này chạy `SELECT 1`; nó xác nhận kết nối, không xác nhận dữ liệu seed hoặc quyền nghiệp vụ. Nếu không kết nối được, trả HTTP 503 với trạng thái unavailable, không lộ chi tiết lỗi kết nối.

## Bước 8 - Kiểm tra TypeScript và bản build

Mở Terminal thứ hai, vào gốc repo rồi chạy:

```bash
npm run typecheck
npm run build
```

Typecheck kiểm tra các kiểu dữ liệu; build kiểm tra có tạo được bản chạy production. Hai lệnh không thay thế việc mở trang và đối chiếu DB thật. Trang `/dev/database` phải không truy cập được trong production; chỉ dùng để phát triển tại máy cá nhân.

## Bước 9 - Hiểu luồng code trước khi bàn giao

Mở `src/app/dev/database/page.tsx`: đây là Server Component, chạy ở server để đếm bản ghi. Nó gọi `getDb()` trong `src/lib/db.ts`. Hàm này sử dụng Prisma Client sinh từ schema cũ và kết nối PostgreSQL bằng adapter pg.

Luồng là: trình duyệt mở trang -> Next.js phía server -> Prisma -> PostgreSQL -> server trả giao diện có số liệu. DATABASE_URL không đưa xuống trình duyệt.

Chúc có thể viết Route Handlers trong `src/app/api/reports/route.ts` và `src/app/api/manager/issues/route.ts`. Hai endpoint đó chưa được tạo ở bước này, vì phần kiểm tra phiên/quyền và nghiệp vụ phải được triển khai cùng Auth/RBAC v1.

## Khi gặp lỗi

| Lỗi | Việc kiểm tra |
| --- | --- |
| Không có script dev | Đang ở sai thư mục; chuyển tới gốc repo VastFix. |
| Thiếu DATABASE_URL | Đã tạo `.env` ở gốc repo chưa; khởi động lại Next.js sau khi sửa cấu hình. |
| Không tìm thấy generated/prisma/client | Chạy `npm run db:generate` tại gốc repo. |
| Trang DB báo chưa kết nối | Kiểm tra Compose healthy, cổng 5433, migration và URL. |
| Bảng có số 0 | Đã chạy seed vào đúng DB chưa; kiểm tra `npm run db:verify`. |
| Cổng 3000 đã dùng | Xem địa chỉ thực tế Terminal in ra và mở đúng địa chỉ đó. |
| `/dev/database` trả 404 khi chạy production | Đây là hành vi có chủ ý; kiểm tra số liệu bằng chế độ `npm run dev`. |

Sau khi hoàn thành, Hải Anh có thể báo: “Khung Next.js đã chạy và đọc được dữ liệu DB chung; bước tiếp theo là triển khai đăng nhập và các API nghiệp vụ.” Việc commit/push được thực hiện sau khi kiểm tra bản chuẩn bị.

Tham khảo: [Next.js Installation](https://nextjs.org/docs/app/getting-started/installation).
