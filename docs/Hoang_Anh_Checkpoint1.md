# Bản chạy chung và kiểm tra tích hợp của Hoàng Anh

Nhánh `feat/hoang-anh-integration` tạo từ `feat/web-foundation` và ghép nguyên các nhánh đã push: `feat/chuc-report-api` (8cd69d3), `feat/thanh-le-checkpoint1-ai` (4e6b2b0) và, ngày 21/11, `codex/duong-reporter-frontend` (5bb7288). Nhánh của Dương đã gồm giao diện quản lý của Sơn (e9236c0), bản sửa API e5ebe19 và đăng nhập USTH của Hải Anh (`feat/auth-foundation`, 07220a3). Không sửa code, schema, migration hay field API của các bạn. Phần thêm mới: `compose.yaml`, `Dockerfile`, `.dockerignore`, hai script trong `scripts/` và các lệnh `npm run` tương ứng. Xung đột chỉ ở README, `package.json` và `.env.example`: giữ nội dung của cả hai bên.

## Chạy bản chung

Cần Docker Desktop đang chạy và Node 24. Chạy từ thư mục gốc.

```powershell
npm.cmd ci
npm.cmd run demo:env
npm.cmd run stack:up
```

- `demo:env` chạy `auth:setup` của Hải Anh (tạo `BETTER_AUTH_SECRET` riêng cho máy), rồi thêm ba mật khẩu demo ngẫu nhiên `VASTFIX_DEMO_REPORTER_PASSWORD`, `VASTFIX_DEMO_STAFF_PASSWORD`, `VASTFIX_DEMO_MANAGER_PASSWORD`. Không ghi đè giá trị đã có. `.env` không đưa lên Git.
- `stack:up` (`docker compose up -d --build --wait`) dựng các service và chờ đến khi healthy:

| Service | Việc làm |
| --- | --- |
| `db` | PostgreSQL 17, volume riêng, cổng host 5434. |
| `migrate` | `db:deploy` → `db:seed` → `db:verify` rồi dừng với exit 0. Chạy lại mỗi lần `up`; seed dùng upsert nên không nhân đôi dữ liệu. |
| `mailpit` | Hộp thư thử cho email xác minh, xem tại http://127.0.0.1:8025. Không gửi thư ra ngoài. |
| `ai` | Build từ `ai-service/` của Thành Lê, baseline mặc định, cổng 8000. |
| `web` | Next.js ở http://127.0.0.1:3000 với `FASTAPI_BASE_URL=http://ai:8000`, `DUPLICATE_TIMEOUT_MS=5000`, Better Auth gửi thư qua `mailpit`, và `VASTFIX_DEMO_AUTH=1` để script kiểm tra dùng phiên demo. |

Trang chính: `/vi`, `/en`, form báo sự cố `/vi/reports/new`, hàng đợi quản lý `/vi/manager/issues`, đăng ký `/register`, đăng nhập `/login`. Đăng ký bằng địa chỉ thử `@usth.edu.vn`, mở Mailpit để bấm link xác minh. Tài khoản tự đăng ký luôn là REPORTER; muốn thử vai quản lý thì dùng `auth:bootstrap-manager` theo `Auth_Implementation_Step_by_Step.md`.

Web Docker hiện chạy `next dev --webpack` vì phiên demo của Chúc chỉ bật khi development và host là loopback. Mở web bằng `127.0.0.1` hoặc `localhost`, không dùng IP LAN. Trang `/dev/database` cũng mở được.

Xem trạng thái bằng `npm.cmd run stack:ps`, log bằng `npm.cmd run stack:logs`. Dừng bằng `npm.cmd run stack:down`; lệnh này giữ dữ liệu. Không dùng `docker compose down -v` trừ khi muốn xóa sạch DB của bản chung.

Bản chung dùng Compose project `vastfix`, volume và cổng DB riêng, nên không đụng DB `vastfix-local-db` cổng 5433 mà mọi người dùng với `npm run dev`. Nếu đang chạy `ai-service/compose.yaml` của Thành Lê hoặc Next dev ở cổng 3000/8000, dừng trước, hoặc đặt `VASTFIX_WEB_PORT`, `VASTFIX_AI_PORT`, `VASTFIX_DB_PORT` trong `.env`.

## Kiểm tra tích hợp

```powershell
npm.cmd run check:integration
npm.cmd run check:integration -- --write
npm.cmd run check:integration -- --fallback --auth --report ket-qua.md
```

Script đọc mật khẩu demo từ `.env`, đăng nhập ba vai qua `POST /api/dev/session`, chạy các ca dưới đây rồi thu hồi phiên. Mặc định chỉ đọc. `--write` tạo một Report thật trong DB của bản chung. `--fallback` gồm `--write`, tạm dừng service `ai` bằng `docker compose stop ai`, kiểm tra rồi bật lại và đợi AI sống. `--auth` đăng ký một tài khoản thử `check-…@usth.edu.vn`, xác minh qua Mailpit và kiểm tra phiên thật. Lệnh trả exit 1 khi có ca lỗi.

| Mã | Kiểm tra | Owner khi lỗi |
| --- | --- | --- |
| WEB-01 | Trang `/vi` mở được | Hải Anh + Sơn |
| WEB-02 | `/api/health` báo `database: ok` | Hải Anh |
| AI-01 | FastAPI `/health` đúng contract 4.5 | Thành Lê |
| AI-02 | `POST /duplicates` với `ai-service/demo/h2-03.json`: ID thuộc candidates, score giảm dần, H2-03 đứng trên H2-04 | Thành Lê |
| AUTH-01 | Không có phiên: gửi Report và xem hàng đợi đều `401 UNAUTHENTICATED` | Chúc |
| AUTH-00 | Đăng nhập demo được cả ba vai | Chúc |
| AUTH-06 | REPORTER và STAFF gọi hàng đợi bị `403`, response không có `items` | Chúc |
| API-01 | Gợi ý qua web: `aiStatus: ok`, tối đa 5, đủ field contract 4.1, H2-03 đứng trên H2-04 | Chúc + Thành Lê |
| UI-01 | 8 trang `/vi`, `/en`, form báo sự cố, hàng đợi quản lý, `/login`, `/register` trả 200 | Sơn + Dương |
| UI-02 | `/` tự chuyển sang trang theo ngôn ngữ | Sơn |
| OPT-01 | `GET /api/report-options` có cây A1 → tầng 2 → hành lang giữa cho form | Dương |
| API-02 | Người báo gửi Report: `201`, Issue `SUBMITTED` (cần `--write`) | Chúc + Hải Anh |
| API-03 | Quản lý xem hàng đợi: đủ field contract 4.3, có Issue vừa tạo | Chúc + Sơn |
| FB-01 | AI tắt: gợi ý trả `aiStatus: unavailable`, vẫn gửi được Report và quản lý thấy phiếu (cần `--fallback`) | Chúc |
| AUTH-R1 | Đăng nhập thật: chặn email ngoài USTH, chặn đăng nhập trước khi xác minh, thư tới Mailpit, tự xin MANAGER vẫn thành REPORTER, REPORTER bị 403 ở hàng đợi, gợi ý chạy với phiên thật, đăng xuất xong bị 401 (cần `--auth`) | Hải Anh |

Script không thay thế các ca kiểm thử riêng của từng người (`scripts/check-report-api.mjs`, `scripts/check-duplicates.mjs`, `scripts/check-auth.mjs`, `npm run test:ui`, `npm run test:reporter-flow`, `ai-service/tests/`). UI-01 chỉ xác nhận trang mở được trên bản chung; hành vi giao diện do test Playwright của Sơn và Dương kiểm tra.

### Kết quả 21/11/2026 (sau khi ghép Sơn, Dương, auth)

Image dựng lại từ đầu; `migrate` áp thêm migration `better_auth` và verify đạt; `npm run typecheck` đạt. `check:integration -- --fallback --auth`: **15/15 ca đạt**. Gợi ý qua web trả 4 gợi ý, H2-03 trên H2-04.

### Kết quả 19/11/2026

Chạy trên Windows với Docker Desktop, image `node:24-bookworm-slim`, `postgres:17` và Dockerfile Python 3.13 của Thành Lê. DB đã có migration đầu từ trước; `migrate` áp thêm hai migration của Chúc (`demo_sessions`, `issue_merge`) và verify đạt. `npm run typecheck` đạt.

`check:integration -- --fallback`: **11/11 ca đạt**. Gợi ý qua web 152 ms, 2 gợi ý, H2-03 trên H2-04. Khi AI dừng, gợi ý trả `unavailable` sau 65 ms vì kết nối bị từ chối ngay; ca quá hạn 5 giây Thành Lê đã đo riêng.

## Chưa có trong bản chung

- Bộ dữ liệu Công Thành đã được ghép trong bản cập nhật 22/11 ở dưới.
- Lint/format chưa thêm vì sẽ đổi `package-lock.json` chung; cần Hải Anh đồng ý.
- Email thật chưa gửi ra ngoài: bản chung dùng Mailpit.


## Cập nhật tích hợp 22/11/2026

- Docker dùng Webpack để tránh lỗi hydration/vòng reload của Turbopack trong lượt review; `allowedDevOrigins` chỉ bổ sung `127.0.0.1`. Giữ nguyên guard development + loopback của phiên demo và không truyền hostname nội bộ cố định vào Next dev.
- Image cài OpenSSL cho Prisma CLI. `.dockerignore` loại môi trường Python, mô hình tải local, kết quả test và `data/private`.
- Thêm `npm run check:stack-browser`: Chrome chạy đăng ký/xác minh/đăng nhập thật, form với FastAPI thật, DB Report–Issue–event, hàng đợi quản lý, đổi ngôn ngữ và phân trang quá 25 phiếu. Người quản lý trong bài kiểm tra này dùng phiên demo tường minh. Script tạo dữ liệu thử có đánh dấu; dùng DB local riêng nếu cần giữ bản demo sạch.
- Bản hiện tại đã có bộ dữ liệu Công Thành. Email thử vẫn vào Mailpit, chưa gửi tới USTH thật.
- Bằng chứng chạy sau sửa nằm ở `docs/Checkpoint1_Integration_Verification_2026-11-22.txt`; các phần kết quả 19/11 và 21/11 phía trên là lịch sử.
