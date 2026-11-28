# Checkpoint 2 · Runbook dựng bản chung và chạy kiểm thử (bản nháp)

Người viết: Hoàng Anh. Bản nháp 27/11/2026, áp dụng cho nhánh `test/cp2-integration-qa` (commit code `dba9f94`). Sẽ cập nhật commit đóng băng ở HO-05.

## 1. Yêu cầu máy

- Node `>=24.11 <25` (package `engines`). Node 22 không được hỗ trợ.
- Docker Desktop đang chạy (cho stack chung). Các script API tự dựng PostgreSQL 17 tạm, không cần Docker.
- Google Chrome (Playwright dùng `PLAYWRIGHT_CHANNEL=chrome`).
- Windows: đặt repo ở đường dẫn không có dấu tiếng Việt và không nằm trong OneDrive, vì `embedded-postgres` không tìm được `initdb.exe` qua đường dẫn Unicode (lỗi Sơn gặp ngày 26/11).
- Linux: không chạy script API bằng `root`, vì `initdb` từ chối thư mục dữ liệu.

## 2. Lấy bản chung

```powershell
git fetch origin
git switch test/cp2-integration-qa
git pull --ff-only
npm.cmd ci
npm.cmd run demo:env
```

`demo:env` tạo `BETTER_AUTH_SECRET` và mật khẩu demo ngẫu nhiên trong `.env`, không ghi đè giá trị có sẵn. Không commit `.env`, không chiếu `.env` khi demo.

## 3. Kiểm thử không cần stack

```powershell
npm.cmd run typecheck
npm.cmd run build
node scripts/check-workflow-api.mjs
npm.cmd run test:photos
npm.cmd run test:merges
npm.cmd run test:reporter-flow
$env:PLAYWRIGHT_CHANNEL="chrome"; npm.cmd run test:ui
```

AI service: trong `ai-service/` tạo venv, `pip install -r requirements-dev.txt`, rồi `python -m pytest -q tests`.

Mỗi lần chạy, chép log vào `docs/qa-evidence/<ngày>_<commit ngắn>/` và cập nhật `docs/Checkpoint2_Test_Report.md`.

## 4. Dựng stack chung

```powershell
npm.cmd run stack:up
npm.cmd run stack:ps
```

| Service | Ghi chú CP2 |
| --- | --- |
| `db` | PostgreSQL 17, cổng host 5434, volume DB riêng |
| `migrate` | `db:deploy` → `db:seed` → `db:verify`. Áp migration `20261126000000_photo_storage`. Seed dùng upsert, không ghi đè Report đã có |
| `web` | http://127.0.0.1:3000, ảnh lưu ở volume `vastfix_photo_data` (`/app/data/private/photos`) |
| `ai` | http://127.0.0.1:8000, baseline |
| `mailpit` | http://127.0.0.1:8025 (giữ 8026 nếu máy đã cấu hình như vậy) |

Sau khi stack healthy:

```powershell
npm.cmd run check:integration -- --fallback --auth --report docs/qa-evidence/<thư mục>/integration.md
npm.cmd run check:stack-browser
```

## 5. Tài khoản kiểm thử

Cần năm tài khoản `@usth.edu.vn` đăng ký và xác minh qua Mailpit: REPORTER A, REPORTER B, STAFF A, STAFF B, MANAGER.

1. Đăng ký tại `/register`, mở Mailpit, bấm link xác minh.
2. MANAGER đầu tiên: `npm.cmd run auth:bootstrap-manager -- <email>` (chỉ một lần cho mỗi DB).
3. STAFF (tạm, chờ quy trình chính thức của Hải Anh, QA-05): đăng ký + xác minh như bước 1, rồi cấp vai bằng MANAGER đã xác minh. Lệnh trỏ vào DB của stack (cổng 5434), không phải DB dev 5433:

```powershell
$env:DATABASE_URL="postgresql://vastfix_dev:vastfix_dev_only@127.0.0.1:5434/vastfix_dev?schema=public"
npm.cmd run qa:grant-staff -- staff.a@usth.edu.vn manager@usth.edu.vn
Remove-Item Env:DATABASE_URL
```

Script chỉ chạy trên DB localhost, chỉ đổi REPORTER đã xác minh → STAFF và ghi `UserRoleEvent` có người cấp.

Không đưa mật khẩu, cookie hay token vào tài liệu và log.

## 6. Quy tắc an toàn dữ liệu

- Dừng stack bằng `npm.cmd run stack:down`. **Không** dùng `docker compose down -v`, không reset DB người dùng.
- Sao lưu cả DB và volume ảnh trước khi đổi migration.
- Dữ liệu demo có tiền tố `[CP2-DEMO]`, tạo bằng tài khoản thật qua UI/API, không chèn SQL để chứng minh chức năng.

## 7. Kiểm restart (P03)

1. Tạo Report có ảnh, ghi lại issueId và photoId.
2. `npm.cmd run stack:down` rồi `npm.cmd run stack:up`.
3. Mở lại detail và `GET /api/photos/<photoId>` bằng phiên có quyền: Report và ảnh còn, byte ảnh không đổi.
4. Thử upload lỗi (ngắt mạng hoặc tệp hỏng) rồi gửi lại: không sinh Report trùng.

## 8. Sự cố thường gặp

| Hiện tượng | Xử lý |
| --- | --- |
| `PrismaConfigEnvError: DATABASE_URL` khi build/typecheck | Chưa có `.env`: chạy bước 2 |
| `initdb: could not access directory ... Permission denied` | Đang chạy bằng root (Linux): dùng user thường |
| `initdb.exe` không tìm thấy (Windows) | Chuyển repo khỏi OneDrive/đường dẫn có dấu |
| Cổng 3000/8000/5434 bận | Đặt `VASTFIX_WEB_PORT`, `VASTFIX_AI_PORT`, `VASTFIX_DB_PORT` trong `.env` |
| Không kết nối Docker Engine | Mở Docker Desktop, kiểm `docker ps` |
