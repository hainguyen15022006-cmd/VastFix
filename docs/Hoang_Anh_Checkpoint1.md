# Bản chạy chung và kiểm tra tích hợp của Hoàng Anh

Nhánh `feat/hoang-anh-integration` tạo từ `feat/web-foundation` và ghép nguyên hai nhánh đã push: `feat/chuc-report-api` (8cd69d3) và `feat/thanh-le-checkpoint1-ai` (4e6b2b0). Không sửa code, schema, migration hay field API của các bạn. Phần thêm mới: `compose.yaml`, `Dockerfile`, `.dockerignore`, hai script trong `scripts/` và các lệnh `npm run` tương ứng. Xung đột duy nhất là README: giữ cả phần web foundation lẫn dòng giới thiệu ai-service.

## Chạy bản chung

Cần Docker Desktop đang chạy và Node 24. Chạy từ thư mục gốc.

```powershell
npm.cmd ci
npm.cmd run demo:env
npm.cmd run stack:up
```

- `demo:env` tạo `.env` từ `.env.example` nếu chưa có và thêm ba mật khẩu demo ngẫu nhiên `VASTFIX_DEMO_REPORTER_PASSWORD`, `VASTFIX_DEMO_STAFF_PASSWORD`, `VASTFIX_DEMO_MANAGER_PASSWORD`. Không ghi đè giá trị đã có. `.env` không đưa lên Git.
- `stack:up` (`docker compose up -d --build --wait`) dựng bốn service và chờ đến khi healthy:

| Service | Việc làm |
| --- | --- |
| `db` | PostgreSQL 17, volume riêng, cổng host 5434. |
| `migrate` | `db:deploy` → `db:seed` → `db:verify` rồi dừng với exit 0. Chạy lại mỗi lần `up`; seed dùng upsert nên không nhân đôi dữ liệu. |
| `ai` | Build từ `ai-service/` của Thành Lê, baseline mặc định, cổng 8000. |
| `web` | Next.js ở http://127.0.0.1:3000 với `FASTAPI_BASE_URL=http://ai:8000`, `DUPLICATE_TIMEOUT_MS=5000`, `VASTFIX_DEMO_AUTH=1`. |

Web chạy `next dev` vì phiên demo của Chúc chỉ bật khi development và host là loopback. Mở web bằng `127.0.0.1` hoặc `localhost`, không dùng IP LAN. Trang `/dev/database` cũng mở được.

Xem trạng thái bằng `npm.cmd run stack:ps`, log bằng `npm.cmd run stack:logs`. Dừng bằng `npm.cmd run stack:down`; lệnh này giữ dữ liệu. Không dùng `docker compose down -v` trừ khi muốn xóa sạch DB của bản chung.

Bản chung dùng Compose project `vastfix`, volume và cổng DB riêng, nên không đụng DB `vastfix-local-db` cổng 5433 mà mọi người dùng với `npm run dev`. Nếu đang chạy `ai-service/compose.yaml` của Thành Lê hoặc Next dev ở cổng 3000/8000, dừng trước, hoặc đặt `VASTFIX_WEB_PORT`, `VASTFIX_AI_PORT`, `VASTFIX_DB_PORT` trong `.env`.

## Kiểm tra tích hợp

```powershell
npm.cmd run check:integration
npm.cmd run check:integration -- --write
npm.cmd run check:integration -- --fallback --report ket-qua.md
```

Script đọc mật khẩu demo từ `.env`, đăng nhập ba vai qua `POST /api/dev/session`, chạy các ca dưới đây rồi thu hồi phiên. Mặc định chỉ đọc. `--write` tạo một Report thật trong DB của bản chung. `--fallback` gồm `--write`, tạm dừng service `ai` bằng `docker compose stop ai`, kiểm tra rồi bật lại. Lệnh trả exit 1 khi có ca lỗi.

| Mã | Kiểm tra | Owner khi lỗi |
| --- | --- | --- |
| WEB-01 | Trang đầu mở được | Hải Anh |
| WEB-02 | `/api/health` báo `database: ok` | Hải Anh |
| AI-01 | FastAPI `/health` đúng contract 4.5 | Thành Lê |
| AI-02 | `POST /duplicates` với `ai-service/demo/h2-03.json`: ID thuộc candidates, score giảm dần, H2-03 đứng trên H2-04 | Thành Lê |
| AUTH-01 | Không có phiên: gửi Report và xem hàng đợi đều `401 UNAUTHENTICATED` | Chúc |
| AUTH-00 | Đăng nhập demo được cả ba vai | Chúc |
| AUTH-06 | REPORTER và STAFF gọi hàng đợi bị `403`, response không có `items` | Chúc |
| API-01 | Gợi ý qua web: `aiStatus: ok`, tối đa 5, đủ field contract 4.1, H2-03 đứng trên H2-04 | Chúc + Thành Lê |
| API-02 | Người báo gửi Report: `201`, Issue `SUBMITTED` (cần `--write`) | Chúc + Hải Anh |
| API-03 | Quản lý xem hàng đợi: đủ field contract 4.3, có Issue vừa tạo | Chúc + Sơn |
| FB-01 | AI tắt: gợi ý trả `aiStatus: unavailable`, vẫn gửi được Report và quản lý thấy phiếu (cần `--fallback`) | Chúc |

Script không thay thế các ca kiểm thử riêng của từng người (`scripts/check-report-api.mjs`, `scripts/check-duplicates.mjs`, `ai-service/tests/`). Các ca AUTH còn lại trong `Auth_RBAC_v1.md` cần đăng nhập email thật nên vẫn để "Chưa chạy".

### Kết quả 19/11/2026

Chạy trên Windows với Docker Desktop, image `node:24-bookworm-slim`, `postgres:17` và Dockerfile Python 3.13 của Thành Lê. DB đã có migration đầu từ trước; `migrate` áp thêm hai migration của Chúc (`demo_sessions`, `issue_merge`) và verify đạt. `npm run typecheck` đạt.

`check:integration -- --fallback`: **11/11 ca đạt**. Gợi ý qua web 152 ms, 2 gợi ý, H2-03 trên H2-04. Khi AI dừng, gợi ý trả `unavailable` sau 65 ms vì kết nối bị từ chối ngay; ca quá hạn 5 giây Thành Lê đã đo riêng.

## Chưa có trong bản chung

- Frontend của Sơn (`codex/son-manager-frontend`, commit 8bdd7ab) chưa push. Khi push, mình ghép vào nhánh này và thêm bước mở `/vi`, `/en` vào kịch bản kiểm tra.
- Phần form người báo của Dương chưa có nhánh trên GitHub.
- Lint/format chưa thêm vì sẽ đổi `package-lock.json` chung; cần Hải Anh đồng ý.
- Đăng nhập email `@usth.edu.vn` thật chưa có; bản chung chỉ dùng phiên demo của Chúc.
