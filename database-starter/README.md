# VastFix - hướng dẫn Hải Anh tạo nền dữ liệu Checkpoint 1

Bộ này chuyển phần lõi ERD sang Prisma + PostgreSQL: User, Building, Floor, Area, Category, Report, Issue và IssueEvent. Dùng Prisma ORM 7 và Node.js 24; các lệnh chỉ rõ `prisma7.config.ts`. Đây là thư mục thực hành độc lập, chưa phải ứng dụng Next.js hay API của Chúc.

## 1. Mở đúng thư mục

Sau khi clone repo hoặc mở Terminal ở thư mục chứa repo VastFix, chạy:

```bash
cd VastFix/database-starter
pwd
node --version
docker --version
```

`pwd` phải hiện đúng đường dẫn `database-starter`. Cần Node.js 24 (tối thiểu 24.11) và Docker Desktop trên máy của bạn. Docker Desktop cần mở và báo engine đang chạy thì bước 3 mới thực hiện được.

Các file quan trọng:

| File | Bạn cần hiểu gì |
| --- | --- |
| `prisma/schema.prisma` | Các bảng, trường, enum và khóa ngoại từ ERD. |
| `prisma7.config.ts` | Nơi chỉ schema, thư mục migration, lệnh seed và URL kết nối. |
| `.env.example` | Mẫu cấu hình kết nối DB ở máy cá nhân. |
| `compose.database.yaml` | Chạy PostgreSQL phục vụ phát triển ở cổng 5433. |
| `prisma/seed.ts` | Tạo dữ liệu minh họa với ID cố định; chạy lại không chèn thêm bản trùng. |
| `src/db.ts` | Tạo Prisma Client dùng adapter PostgreSQL. |
| `scripts/verify.ts` | Đọc lại dữ liệu mẫu để kiểm tra quan hệ Report-Issue. |

## 2. Cài thư viện và cấu hình

Nếu có `package-lock.json`, chạy:

```bash
npm ci
```

Nếu chưa có lockfile, chạy `npm install` lần đầu; giữ `package-lock.json` để các bạn dùng cùng phiên bản thư viện.

Tạo file `.env` nếu chưa có:

```bash
cp -n .env.example .env
```

URL mẫu là `postgresql://vastfix_dev:vastfix_dev_only@localhost:5433/vastfix_dev?schema=public`. Tên và mật khẩu chỉ dùng cho DB phát triển riêng trong Compose này. `.env` không đưa lên Git; `.env.example` được đưa lên Git.

## 3. Mở PostgreSQL

Mở Docker Desktop, đợi engine chạy rồi quay lại Terminal:

```bash
docker compose -f compose.database.yaml up -d db
docker compose -f compose.database.yaml ps
```

Đợi cột trạng thái hiện `healthy`. Nếu mới hiện `starting`, kiểm tra lại sau vài giây. File này chỉ khởi động DB; web và AI được ghép vào Compose chung cùng Hoàng Anh sau.

## 4. Kiểm tra schema và sinh Prisma Client

```bash
npm run db:validate
npm run db:generate
npm run typecheck
```

`db:validate` kiểm tra schema hợp lệ. `db:generate` sinh thư viện để TypeScript truy vấn DB. `typecheck` kiểm tra các file TypeScript dùng đúng kiểu dữ liệu. Các bước này chưa chứng minh DB đã có bảng hoặc có dữ liệu.

## 5. Áp dụng migration đầu

Nếu bộ này đã có thư mục `prisma/migrations/20261117000000_init_checkpoint1`, chạy:

```bash
npm run db:deploy
```

Lệnh trên áp dụng migration đã chuẩn bị. Nếu chưa có migration đầu, tạo và áp dụng nó bằng:

```bash
npm run db:migrate -- --name init_checkpoint1
```

Migration là lịch sử thay đổi cấu trúc DB. Đưa `prisma/migrations/` lên Git để Chúc và Hoàng Anh tạo được cùng cấu trúc. Sau khi migration đã dùng chung, tạo migration mới cho thay đổi tiếp theo; không sửa file lịch sử cũ. Không dùng `migrate reset` để xử lý lỗi khi chưa biết dữ liệu nào sẽ bị xóa.

## 6. Nạp dữ liệu mẫu và kiểm tra

```bash
npm run db:seed
npm run db:verify
```

Seed tạo:

- 3 User minh họa, mỗi người một vai: REPORTER, STAFF, MANAGER. Email dùng miền `demo.invalid`; đây là bản ghi dữ liệu, chưa đăng nhập được và không thay quy tắc email thật `@usth.edu.vn`.
- Vị trí minh họa A1 -> tầng 2 -> hành lang giữa. Chưa xác minh đây là vị trí thật trong khuôn viên.
- Category ELECTRICAL cho demo. Danh mục 4-6 category chính thức vẫn cần nhóm thống nhất.
- 2 Report về đèn H2-03 và H2-04, mỗi Report có 1 Issue SUBMITTED và 1 sự kiện REPORT_SUBMITTED.

Đây là hai thiết bị khác nhau, dùng làm ca khó không trùng. Khi thử gợi ý, nhập mô tả mới về H2-03 rồi đối chiếu xem H2-03 được xếp trên H2-04. Dùng thời điểm truy vấn gần các mẫu seed khi đánh giá tín hiệu thời gian; không dùng bộ demo này để công bố chỉ số AI.

Chạy seed thêm một lần rồi verify lại:

```bash
npm run db:seed
npm run db:verify
```

Số bản ghi mẫu phải không tăng. Seed dùng upsert với ID cố định và không ghi đè nội dung đã có. `verify` dành cho dữ liệu demo nguyên trạng; nếu bạn cố ý đổi trạng thái mẫu thì kết quả kiểm tra SUBMITTED có thể không còn đạt.

## 7. Xem các bảng

```bash
npm run db:studio
```

Mở địa chỉ mà Terminal in ra. Xem User, Building, Floor, Area, Category, Report, Issue và IssueEvent. Dùng Studio để xem dữ liệu; các thao tác cập nhật thật phải đi qua backend kiểm tra quyền. Prisma Studio không phải màn hình phân quyền của sản phẩm.

Những điểm Hải Anh cần giải thích được khi review:

1. `Report.reporterId` trỏ tới người báo. `Report.areaId` trỏ tới khu vực; từ đó truy ra tầng và tòa, tránh lưu ba ID không khớp nhau. Chúc vẫn phải kiểm tra cả ba ID từ request có đúng quan hệ trước khi lưu.
2. `locationSnapshot` giữ tên vị trí lúc gửi; đổi tên danh mục không được làm thay đổi lịch sử báo cáo.
3. `Issue.originReportId` có `@unique`: một Report không được mở hai Issue. Trường `Report.issue` là tùy chọn trong Prisma vì khóa ngoại nằm phía Issue. Service phải tạo Report + Issue + sự kiện trong một giao dịch để không để lại Report thiếu Issue.
4. `priority`, `assigneeId`, `dueAt`, `confirmedCategoryId` có thể chưa có khi SUBMITTED; quản lý bổ sung lúc xử lý.
5. `Issue.status` có đúng sáu giá trị của contract. Enum không tự kiểm tra ai được chuyển trạng thái; backend của Chúc phải làm phần đó.
6. Khóa ngoại dùng Restrict để không xóa dây chuyền báo gốc. Schema nền chưa tự cấm mọi UPDATE/DELETE của Report; quy tắc giữ bản gốc phải được thực thi ở service, kiểm thử nghiệp vụ và/hoặc migration tăng cường sau.

## 8. Bàn giao cho Chúc và Hoàng Anh

Sau khi bộ thực hành chạy được, thống nhất với Chúc/Hoàng Anh vị trí đặt phần Prisma trong ứng dụng Next.js chung. Bộ này nằm trong thư mục `database-starter/` của repo VastFix; các đường dẫn và lệnh trong tài liệu được tính theo thư mục đó.

Gói bàn giao gồm schema, migration đầu, seed, cấu hình mẫu, lockfile, hướng dẫn chạy và kết quả verify. Không copy `node_modules`, `.env` hoặc `generated` lên Git. Khi ghép vào ứng dụng có sẵn, ghép dependency/script vào package.json hiện có và chỉnh đường dẫn import; không ghi đè toàn bộ cấu hình Next.js bằng package.json của bộ thực hành.

Chúc tiếp tục triển khai:

- `POST /api/reports`: kiểm tra phiên/quyền, vị trí/category, rồi tạo Report + Issue SUBMITTED + IssueEvent trong cùng transaction.
- `GET /api/manager/issues?status=SUBMITTED`: kiểm tra quyền quản lý, đọc DB và trả đúng JSON v1.
- Lọc candidates và gọi FastAPI theo contract, AI lỗi vẫn cho gửi Report.

IssueMerge, IssueFollow, ReportPhoto, WorkEvidence và các bảng hoàn thiện vẫn theo ERD/đặc tả; bộ khởi đầu này chưa triển khai chúng. Chưa bật gộp/hủy gộp cho đến khi có schema và giao dịch bảo toàn dữ liệu tương ứng.

## 9. Khi gặp lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Cannot connect to Docker daemon | Mở Docker Desktop, đợi engine chạy rồi chạy lại bước 3. |
| Port 5433 already allocated | Có dịch vụ khác dùng cổng; đổi cổng bên trái trong Compose và cổng trong DATABASE_URL cho khớp. |
| Environment variable DATABASE_URL not found | Kiểm tra đang ở đúng thư mục và đã tạo `.env`. |
| P1001 / không kết nối PostgreSQL | Kiểm tra Compose healthy và URL trỏ localhost:5433. |
| Cannot find generated/prisma/client | Chạy `npm run db:generate` sau khi cài thư viện. |
| Table does not exist | Chưa áp dụng migration ở bước 5 hoặc đang kết nối sai DB. |

Để tắt DB mà giữ dữ liệu:

```bash
docker compose -f compose.database.yaml down
```

## Tài liệu chính thức dùng để chuẩn bị bộ này

- Prisma ORM 7 + PostgreSQL: https://www.prisma.io/docs/v7/prisma-orm/quickstart/postgresql
- Seed trong Prisma ORM 7: https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding

Prisma 7 cần gọi seed rõ ràng bằng `prisma db seed`; không giả định migrate đã tự nạp seed. Các script của bộ này giữ đúng quy trình đó.
