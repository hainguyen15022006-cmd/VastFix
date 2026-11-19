# Sơn: frontend quản lý và giao diện chung

Ngày: 19/11/2026. Nhánh local: `codex/son-manager-frontend`.

Nền: `feat/web-foundation`, commit `e8afebf0b14bb4a871adcf15541a8acfba6debb7`.

Đây là bản frontend đầu tiên của Sơn cho Checkpoint 1. Không thay API contract, Prisma schema, migration, seed hoặc triển khai backend của thành viên khác. Chưa push. Không coi kiểm thử bằng response mô phỏng là chứng minh tích hợp backend hoặc phân quyền thật.

## Phần đã triển khai

- Khung giao diện dùng chung, điều hướng, trang chủ và đường dẫn `/vi`, `/en` bằng next-intl.
- Hàng đợi tại `/vi/manager/issues` và `/en/manager/issues`.
- Gọi `GET /api/manager/issues?status=SUBMITTED` mặc định bằng session cookie cùng origin, không tự gán user/role hoặc gửi header giả danh.
- Bộ lọc gửi `status` với sáu trạng thái đã có trong contract; tìm mô tả/vị trí trong các phiếu đã tải, hỗ trợ tiếng Việt không dấu.
- Hiển thị summary, locationLabel, status và createdAt; ngày giờ theo locale và `Asia/Ho_Chi_Minh`.
- Hộp xem thông tin tóm tắt từ hàng đợi, kèm issueId/originReportId. Đây không phải trang chi tiết đầy đủ: contract chưa có endpoint lấy toàn bộ nội dung phiếu.
- Trạng thái tải, rỗng, không có kết quả tìm kiếm, 401, 403, lỗi HTTP/network/response sai cấu trúc; nút thử lại/làm mới. Không hiển thị dữ liệu cũ sau khi tải lỗi.
- Hủy request cũ khi đổi trạng thái/rời trang, timeout giao diện 15 giây; không nhầm với timeout AI 5 giây của backend.
- Bố cục desktop/mobile, label cho form, liên kết bỏ qua điều hướng, focus bàn phím và dialog đóng bằng Escape.
- Dữ liệu mô phỏng chỉ ở `tests/ui/`; không có endpoint giả, dữ liệu demo tự thay backend hoặc bypass auth trong code sản phẩm.

## Chạy tại gốc repo

Dùng Node **24.11 trở lên và nhỏ hơn 25**, đúng `engines` của khung chung. Không chạy lệnh web ở `database-starter/`.

```sh
npm ci
# Tạo .env từ .env.example nếu chưa có; không ghi đè cấu hình đang dùng.
docker compose -f database-starter/compose.database.yaml up -d --wait db
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:verify
npm run dev
```

Trên Windows PowerShell, tạo `.env` bằng `if (-not (Test-Path .env)) { Copy-Item .env.example .env }`.

Mở URL mà Next.js in ra, thêm `/vi/manager/issues` hoặc `/en/manager/issues`. `/dev/database` giữ nguyên URL và chỉ hoạt động ở development. `/api/health` không bị chuyển hướng sang đường dẫn ngôn ngữ.

**Ở nền hiện tại chưa có `/api/manager/issues`:** màn hàng đợi hiển thị “Chưa thể tải hàng đợi”. Đây là trạng thái đúng; DB có seed không tự làm API hàng đợi xuất hiện. Không hạ quyền hoặc đọc DB trực tiếp từ frontend để che phần tích hợp còn thiếu.

## Chúc/Hải Anh cần nối

Response thành công v1:

```json
{
  "items": [
    {
      "issueId": "66666666-6666-4666-8666-666666666666",
      "originReportId": "55555555-5555-4555-8555-555555555555",
      "summary": "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
      "locationLabel": "A1 · tầng 2 · hành lang giữa",
      "status": "SUBMITTED",
      "createdAt": "2026-11-19T02:30:00Z"
    }
  ],
  "nextCursor": null,
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
}
```

Backend kiểm tra session, xác minh email và vai theo Auth/RBAC v1, rồi trả 401/403 đúng contract. Frontend chỉ phản ánh kết quả; shell quản lý không phải một lớp bảo vệ dữ liệu. Chưa có URL đăng nhập chính thức nên chưa tạo liên kết hoặc form đăng nhập tự thiết kế. Khi Hải Anh giao luồng đăng nhập, nối lời nhắc 401 tới đường dẫn đó.

Contract có `nextCursor` nhưng chưa mô tả tham số request cho trang kế tiếp. Frontend hiện không tự đặt query `cursor`/`page`, không âm thầm tải toàn khuôn viên. Khi `nextCursor` khác null, UI ghi rõ danh sách còn thiếu và tìm kiếm chỉ trên phần đã tải. Cần Chúc xác nhận quy tắc phân trang trước khi thêm nút tải tiếp.

Bộ lọc trạng thái dùng field `status` hiện có. Cần kiểm tra tích hợp với backend cho sáu giá trị enum; không tự bổ sung lọc server theo vị trí khi chưa có hợp đồng query. `locationLabel` là text server trả về, không thể tự dịch chính xác bằng cách đoán cấu trúc. Mô tả/summary giữ nguyên cả khi đổi ngôn ngữ giao diện.

## Dương dùng phần chung

| Đường dẫn | Công dụng |
| --- | --- |
| `src/app/[locale]/layout.tsx` | Root layout cho sản phẩm: html lang, provider ngôn ngữ và AppShell |
| `src/components/shared/app-shell.tsx` | Logo, header, điều hướng, chuyển vi/en, footer |
| `src/components/shared/icon.tsx` | Icon SVG dùng chung |
| `src/i18n/routing.ts` | Danh sách locale và locale mặc định |
| `src/i18n/navigation.ts` | Link/usePathname/useRouter có locale |
| `src/i18n/request.ts` | Dictionary, timezone; dùng `next/root-params` của Next 16.4 |
| `messages/vi.json`, `messages/en.json` | Chuỗi giao diện; thêm key tương ứng ở cả hai file |
| `src/app/globals.css` | Các class `vf-*`; giữ style cũ của trang kiểm tra DB |
| `src/lib/manager-issues.ts` | DTO public và adapter đọc hàng đợi, không import Prisma |

Đặt trang người báo/nhân viên dưới `src/app/[locale]/...`, dùng Link từ `@/i18n/navigation`, không viết cứng `/vi` vào link nội bộ. Thêm namespace dịch riêng cho màn của mình. `src/app/layout.tsx` cũ được thay bằng root layout `[locale]`; trang dev có layout riêng tại `src/app/dev/layout.tsx` để giữ URL cũ. Khi bổ sung auth/proxy, phối hợp sửa `src/proxy.ts` hiện có thay vì tạo middleware thứ hai. Proxy ngôn ngữ không thay kiểm tra quyền backend.

## Kiểm thử

```sh
npm run typecheck
npm run build
# Lần đầu nếu chưa có trình duyệt cho Playwright:
npx playwright install chromium
npm run test:ui
```

Nếu máy có Chrome và muốn dùng Chrome sẵn có, PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'chrome'; npm run test:ui`. Test runner tự mở bản production tại `127.0.0.1:3100`, rồi dừng server khi xong. Không dùng server đã chạy sẵn trên cổng này.

Các ca trong `tests/ui/manager-queue.spec.ts`: dữ liệu đúng contract, vi/en giữ nguyên mô tả, tìm không dấu, partial list, empty, 401/403/500, network retry, JSON sai, request cũ trả muộn, mobile/keyboard dialog, render nội dung như text, dev page bị chặn ở production và backend thật chưa tồn tại. Response mô phỏng không chứng minh backend phân quyền hoặc giao dịch tạo Report đúng.

Xem kết quả thực tế trong `docs/Son_Frontend_Verification.md`. Cần một vòng tích hợp sau khi backend/auth được ghép: người báo tạo Report thật → quản lý thấy Issue; REPORTER/STAFF không lấy được hàng đợi; đổi quyền/đăng xuất làm request sau bị từ chối.
