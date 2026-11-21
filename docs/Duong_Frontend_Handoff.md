# Dương — Form báo sự cố và gợi ý trùng

Ngày: 21/11/2026. Nhánh local: `codex/duong-reporter-frontend`.

## Phần đã làm

- `/vi/reports/new`, `/en/reports/new`: form mô tả, danh mục tùy chọn, vị trí trong nhà/ngoài trời, cặp tọa độ tùy chọn.
- Dùng shell, CSS, icon và next-intl của Sơn. Thêm liên kết Báo sự cố ở trang chủ và điều hướng; điều hướng mobile có thể xuống hàng.
- Danh mục từ DB qua `GET /api/report-options`, có xác thực và xử lý lỗi/tải lại. Xem [hợp đồng bổ sung](Report_Options_API_v1.md).
- Gọi `POST /api/duplicate-suggestions` theo thao tác người dùng. Phân biệt không có gợi ý và AI không khả dụng; kiểm tra không bắt buộc trước khi gửi.
- Hiển thị mô tả/vị trí/thời gian và lý do Việt/Anh. Không hiển thị score thành xác suất, không tự gộp hoặc hiển thị nút theo dõi chưa có API.
- Sửa nội dung/vị trí/danh mục lập tức hủy gợi ý cũ; response về muộn không ghi đè dữ liệu mới.
- `POST /api/reports` dùng đúng camelCase, không sửa mô tả gốc, không gửi ID người dùng/vai từ frontend.
- Chống bấm gửi liên tiếp, không tự retry request tạo báo cáo. Mất kết nối/timeout/response không hợp lệ thông báo kết quả chưa xác định, vì server có thể đã lưu.
- Sau HTTP 201 đúng cấu trúc: hiển thị mã Report, Issue, trạng thái SUBMITTED và thời gian Việt Nam; có nút tạo báo cáo khác.
- Giữ nội dung trên trang khi lỗi. Đăng nhập lại mở tab mới để tránh mất nội dung; không lưu mô tả vào localStorage.
- Loading, lỗi quyền/phiên, validation, lỗi danh mục, mảng rỗng, AI lỗi; label, focus, thông báo cho screen reader và layout mobile.

Giới hạn mô tả 5000 đơn vị UTF-16 khớp backend Chúc. Upload ảnh, theo dõi, danh sách báo cáo của tôi và thao tác nhân viên nằm ngoài lát cắt Checkpoint 1 của tài liệu đã chốt.

## Nền tích hợp

- Sơn: `e9236c0` — shell và hàng đợi quản lý.
- Hải Anh: `07220a3` — auth, chứa API Chúc và bản sửa `e5ebe19`.
- Giữ nguyên schema, migration, seed và API nghiệp vụ từ nhánh auth.
- Đưa `/login`, `/register`, `/account` vào route group `(auth)` có root layout riêng; URL giữ nguyên. Proxy locale bỏ qua ba URL này, API và trang dev.
- Nhánh này chưa đưa service AI của Thành Lê vào cây nguồn. Chạy service ấy từ checkout/nhánh AI riêng và đặt `FASTAPI_BASE_URL` cho web. Nếu AI không chạy, frontend vẫn gửi báo cáo được.
- Chưa push hoặc mở PR.

## Chạy ứng dụng với DB của nhóm

Từ gốc checkout, Node 24.11–24.x và Docker Desktop hoạt động:

```powershell
npm ci
npm run auth:setup
docker compose -f database-starter/compose.database.yaml up -d --wait db
docker compose -f compose.mail.yaml up -d
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:verify
npm run dev
```

Mở `http://127.0.0.1:3000/register`, đăng ký bằng địa chỉ `@usth.edu.vn` thử của bạn. Trong cấu hình phát triển mặc định, mở thư xác minh ở Mailpit `http://127.0.0.1:8025`; không có thư gửi ra hộp USTH thật. Sau xác minh, đăng nhập và mở `http://127.0.0.1:3000/vi/reports/new`.

Theo [hướng dẫn auth của Hải Anh](Auth_Implementation_Step_by_Step.md) để khởi tạo quản lý. Không dùng ba User trong seed như tài khoản đăng nhập có mật khẩu.

Seed chỉ có A1/tầng 2/hành lang giữa và ELECTRICAL minh họa. UI hiện đúng danh mục DB; không tự bịa danh mục chính thức. Thay cấu hình `.env` theo môi trường riêng, không commit secret.

## Kiểm thử

```powershell
npm run typecheck
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:ui
npm run test:reporter-flow
```

- `test:ui`: 26 ca cho form Dương và hàng đợi Sơn, đa số response API được mô phỏng trong test. Nếu không có Chrome, cài Chromium qua `npx playwright install chromium`, bỏ biến `PLAYWRIGHT_CHANNEL` cho test UI.
- `test:reporter-flow`: tự tạo PostgreSQL 17 độc lập trong `data/private/reporter-flow-*`, áp migration/seed, tạo tài khoản thử ngẫu nhiên, chạy Next.js production và Chrome. Dừng server, xóa cluster thử khi xong. Không đọc hoặc sửa DB trong `.env`, không gửi email thật.
- Cổng mặc định: web 3120, DB 55439, upstream AI fixture 18339; có thể đổi bằng `REPORTER_TEST_PORT`, `REPORTER_TEST_DB_PORT`, `REPORTER_TEST_AI_PORT`.
- Để dùng Chromium đã cài với integration script thay Chrome, đặt `PLAYWRIGHT_CHANNEL=chromium`.
- Integration dùng PostgreSQL native, không yêu cầu Docker. Dependency `embedded-postgres` chỉ nằm trong devDependencies. Trên môi trường Linux, chạy bằng user thường; script không tạo user hệ thống hoặc xin quyền root.
- Kết quả và giới hạn kiểm chứng: [Duong_Frontend_Verification.md](Duong_Frontend_Verification.md).

## Điểm phối hợp còn lại

1. Hải Anh/Chúc review API đọc danh mục mới trước khi ghép nhánh chung; không có thay đổi payload v1 cũ.
2. Bộ lọc sáu trạng thái của Sơn vẫn có từ nhánh gốc; API Chúc hiện chỉ nhận SUBMITTED. Luồng demo dùng mặc định này. Việc mở rộng bộ lọc cần thống nhất với hai bạn.
3. Frontend Sơn chưa tải trang tiếp theo; backend Chúc đã có `cursor`. Phần này không thay đổi trong công việc form người báo.
4. Chạy lại với FastAPI thật của Thành Lê để xác nhận mô hình, latency và reason codes từ service thật. Test tích hợp hiện chứng minh kết nối và fallback bằng upstream fixture.
5. Nếu đổi ngôn ngữ/rời trang/tải lại, bản nháp chưa gửi không được lưu lâu dài; thông báo “giữ nội dung” chỉ áp dụng khi vẫn ở cùng trang sau lỗi.

## File chính

| File | Nội dung |
| --- | --- |
| `src/components/reporter/report-form.tsx` | Form, trạng thái gợi ý/gửi và màn thành công |
| `src/lib/reporter-api.ts` | DTO và kiểm tra response public API |
| `src/app/api/report-options/route.ts` | Danh mục có xác thực |
| `src/app/[locale]/reports/new/page.tsx` | Route Việt/Anh |
| `messages/vi.json`, `messages/en.json` | Nội dung và lý do gợi ý |
| `tests/ui/reporter-form.spec.ts` | Kiểm thử giao diện |
| `scripts/check-reporter-flow.mjs` | Kiểm thử xuyên suốt với DB thật |
