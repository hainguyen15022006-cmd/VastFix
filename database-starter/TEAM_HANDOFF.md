# Bàn giao nền dữ liệu Checkpoint 1

Nhánh: `feat/checkpoint1-database`. Mốc bàn giao: 17/11/2026.

## Nếu đã có repo trên máy

Lưu hoặc commit công việc đang làm trước khi đổi nhánh. Từ thư mục repo VastFix:

```bash
git fetch origin
git switch --track origin/feat/checkpoint1-database
cd database-starter
npm ci
cp -n .env.example .env
```

Lệnh `switch --track` dùng cho lần đầu chưa có nhánh local. Nếu đã có nhánh, dùng `git switch feat/checkpoint1-database` rồi `git pull --ff-only` từ thư mục repo.

## Nếu chưa clone

```bash
git clone --branch feat/checkpoint1-database https://github.com/hainguyen15022006-cmd/VastFix.git
cd VastFix/database-starter
npm ci
cp -n .env.example .env
```

## Chạy DB mẫu

Mở Docker Desktop, đợi engine chạy. Chạy từng lệnh trong thư mục `database-starter`:

```bash
docker compose -f compose.database.yaml up -d db
docker compose -f compose.database.yaml ps
```

Đợi DB `healthy`, sau đó:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm run db:deploy
npm run db:seed
npm run db:verify
```

Mỗi máy có DB riêng, tạo cùng dữ liệu nhờ migration và seed. Git không đồng bộ dữ liệu DB đang chạy.

## Chúc

- Đọc schema, seed và hợp đồng API trong `docs/`.
- Dùng ID vị trí mẫu từ seed để làm validation và tạo Report.
- Triển khai tạo Report + Issue SUBMITTED + IssueEvent trong một giao dịch.
- Triển khai hàng đợi chỉ cho quản lý và endpoint gợi ý theo contract v1.
- Bộ này chưa có Next.js hay API; phối hợp với Hải Anh/Hoàng Anh khi ghép Prisma vào ứng dụng chung. Không ghi đè package.json của ứng dụng bằng package.json của bộ thực hành.

## Thành Lê

- Đọc phần `POST /duplicates` và `GET /health` trong hợp đồng API v1.
- Làm FastAPI bằng JSON candidates mẫu; không cần kết nối PostgreSQL.
- Nhận `query_time`, mô tả, vị trí và candidates từ backend; chỉ trả các report_id có trong request, score và reason_codes đúng schema.
- Ghi model_version và phối hợp Chúc kiểm tra timeout/fallback khi AI lỗi.

## Đã kiểm tra

Trên máy Hải Anh: DB healthy, migration đã áp dụng, verify dữ liệu mẫu đạt. Chưa triển khai API web, đăng nhập, phân quyền runtime hay thao tác gộp/hủy gộp. Xem `VERIFICATION.md` và `README.md` để biết phạm vi chính xác.
