# Checkpoint 2 · Workflow API

Bản triển khai đề xuất trên `feat/cp2-workflow-api` để Hải Anh và frontend xác nhận. Dùng phiên của backend CP1, UUID và camelCase. Thời gian trả về theo UTC. Hạn xử lý do quản lý cung cấp và xác nhận trong `dueAt`.

## Đọc dữ liệu

| Method và đường dẫn | Quyền và kết quả |
| --- | --- |
| `GET /api/manager/issues?status=SUBMITTED` | MANAGER. Mặc định `SUBMITTED`. Nhận cả sáu trạng thái trong bảng dưới, giữ dạng `{items, nextCursor, requestId}` của CP1. |
| `GET /api/manager/issues/:id` | MANAGER. Trả `{issue, requestId}` cho phiếu có ID tương ứng. |
| `GET /api/manager/staff` | MANAGER. Trả `{items: [{id, name}], requestId}` gồm các STAFF đã xác minh. |
| `GET /api/staff/issues` | STAFF. Trả danh sách phiếu được giao cho tài khoản hiện hành. Mặc định lấy mọi trạng thái, có thể lọc bằng `status`. |
| `GET /api/staff/issues/:id` | STAFF được giao phiếu hiệu lực. Trả `{issue, requestId}`. Phiếu của người khác trả 404. |

Danh sách phiếu dùng tối đa 25 mục/trang, sắp mới trước và truyền `nextCursor` dưới dạng `?cursor=...` ở trang sau. List bỏ nguồn đang gộp. `?locale=vi|en` điều khiển nhãn vị trí. Danh sách staff issues có thêm `version`, `priority` và `dueAt`.

Chi tiết có `id`, `originReportId`, `status`, `categoryCode`, `priority`, `dueAt`, `createdAt`, `closedAt`, `assigneeId`, `assignee`, `version`, `reviewRequired`, `mergedIntoIssueId`, `reports` và `history`. `reports` gồm Report gốc của Issue và các Report nguồn đang gộp vào Issue, kèm vị trí và danh sách ảnh theo quan hệ hiện hành. `history` gồm event với `id`, `eventType`, `actorUserId`, `occurredAt`, `details` và `evidencePhotos`. Sau khi nộp, ảnh nằm ở đúng event `WORK_SUBMITTED` của lượt đó.

## Ghi dữ liệu

Gọi `POST /api/manager/issues/:id/:action` hoặc `POST /api/staff/issues/:id/:action`. Mỗi request cần `expectedVersion` lấy từ detail mới nhất. Body chỉ nhận các trường nêu dưới đây.

| Vai / action | Điều kiện trạng thái → kết quả | Trường thêm | Event |
| --- | --- | --- | --- |
| MANAGER / `triage` | SUBMITTED → TRIAGED | `categoryCode`, `priority` (P0/P1/P2), `dueAt` (ISO 8601 có múi giờ) | ISSUE_TRIAGED |
| MANAGER / `assign` | TRIAGED → ASSIGNED | `assigneeId` là STAFF đã xác minh | ISSUE_ASSIGNED |
| STAFF / `start` | ASSIGNED → IN_PROGRESS | | WORK_STARTED |
| STAFF / `progress` | IN_PROGRESS → IN_PROGRESS | `progressNote`, `materials` tùy chọn, đều là văn bản | WORK_PROGRESS_UPDATED |
| STAFF / `submit` | IN_PROGRESS → AWAITING_REVIEW | `completionNote`, `evidencePhotoIds` gồm 1–3 ảnh đã lưu | WORK_SUBMITTED |
| MANAGER / `return-work` | AWAITING_REVIEW → IN_PROGRESS | `reason`. Giữ assignee và lịch sử minh chứng | WORK_RETURNED |
| MANAGER / `close` | AWAITING_REVIEW → CLOSED | `evidenceReviewed: true`. Backend kiểm tra minh chứng của lần nộp và ghi `closedAt` | ISSUE_CLOSED |
| MANAGER / `reopen` | CLOSED → TRIAGED | `reason`. Xóa `closedAt` và assignee, giữ lịch sử | ISSUE_REOPENED |
| MANAGER / `return-to-triage` | ASSIGNED hoặc IN_PROGRESS → TRIAGED | `reason`. Bỏ giao cho nhân viên cũ | ISSUE_RETURNED_TO_TRIAGE |

Ví dụ body tiếp nhận và response HTTP 200, ID rút gọn để minh họa dạng dữ liệu.

```json
{"expectedVersion":1,"categoryCode":"ELECTRICAL","priority":"P1","dueAt":"2026-11-26T14:00:00+07:00"}
```

```json
{
  "issue":{"id":"<issue UUID>","status":"TRIAGED","assigneeId":null,"closedAt":null,"dueAt":"2026-11-26T07:00:00.000Z","priority":"P1","version":2},
  "event":{"id":"<event UUID>","eventType":"ISSUE_TRIAGED","occurredAt":"2026-11-24T08:30:00.000Z"},
  "requestId":"<request UUID>"
}
```

STAFF chỉ thay đổi phiếu của mình. Backend lấy actor từ phiên, từ chối ghi vào nguồn đang gộp hoặc phiếu có `reviewRequired`, và thêm from/to cùng nội dung sự kiện trong một transaction. Event đã ghi cần được giữ lại vì `version` dùng số sự kiện hiện có của Issue. Các mutation phối hợp với workflow, kể cả merge/reverse/review, cần ghi event cùng transaction và khóa/cập nhật hàng Issue tương ứng. Transaction Serializable bảo đảm hai thay đổi workflow cạnh tranh từ cùng version chỉ có thể lưu một lần.

| HTTP | Ý nghĩa |
| --- | --- |
| 400 | Payload, bộ lọc, danh mục, assignee hoặc minh chứng không hợp lệ |
| 401 / 403 | Thiếu phiên / vai không được phép hoặc chưa xác minh |
| 404 | Phiếu hoặc thao tác không tìm thấy. STAFF không được biết phiếu của người khác |
| 409 | Trạng thái, merge guard, thiếu minh chứng để đóng hoặc version xung đột. Giao diện tải lại detail |
| 503 | Lớp lưu ảnh chưa sẵn sàng |

Ví dụ xung đột theo cấu trúc lỗi CP1.

```json
{"error":{"code":"WORKFLOW_CONFLICT","message":"Phiếu đã thay đổi, hãy tải lại"},"requestId":"<request UUID>"}
```

## Phụ thuộc cần ghép với Hải Anh

`src/lib/workflow/photos.ts` là điểm kết nối tới lớp lưu ảnh. Bảng `Photo` chính thức được tạo bởi migration `20261126000000_photo_storage`, giữ các trường adapter đang dùng: `id`, `ownerUserId`, `issueId`, `reportId`, `purpose` (`REPORT` hoặc `WORK_EVIDENCE`), `storedAt`, `submissionEventId`, `createdAt`. Thông tin tệp bổ sung gồm `storageKey` duy nhất, `mimeType` và `sizeBytes` bắt buộc. `purpose` dùng enum PostgreSQL `PhotoPurpose`. SQL trong `tests/fixtures/cp2-workflow-photos.sql` là fixture cũ trước migration, không được chạy cùng migration chính thức.

Upload do Hải Anh triển khai, chỉ ghi `storedAt` sau khi tệp đã được lưu và đăng ký đúng owner, target, purpose. Submit gắn ảnh chưa dùng vào event của phiếu trong cùng transaction, từ chối ảnh sai chủ sở hữu, sai Issue, sai purpose, chưa lưu hoặc đã dùng. `GET /api/photos/:id` do Hải Anh kiểm tra quyền tải tệp riêng tại thời điểm truy cập, kể cả sau hủy gộp. Khi thiếu bảng ảnh, detail trả danh sách ảnh rỗng và submit trả 503 giữ nguyên Issue/event.

## Kiểm thử

```bash
npm run typecheck
npm run build
node scripts/check-workflow-api.mjs
```

Script dùng PostgreSQL 17 riêng, chạy toàn bộ migration chính thức gồm bảng Photo, đăng nhập qua Better Auth với dữ liệu tài khoản kiểm thử đã xác minh. Dữ liệu ảnh trong test chỉ là metadata giả lập, chưa kiểm chứng upload hoặc byte tệp thật. Test riêng mô phỏng thiếu bảng ảnh để kiểm tra 503 và rollback; không tạo bảng Photo thứ hai. Kiểm tra phân quyền, lọc/phân trang, triage/assign/start, progress, các lần nộp/trả lại, close/reopen và xung đột song song. Ghép trên bản chung và kiểm lại với API upload/file thật trước khi báo DONE.

## Bàn giao API upload và đọc tệp

Xem [Photo_API_CP2.md](Photo_API_CP2.md) để nối upload, photoIds của Report, evidencePhotoIds và quyền đọc/xóa ảnh nháp. Kết quả kiểm chứng ngày 26/11 nằm trong [Photo_API_Verification_2026-11-26.txt](Photo_API_Verification_2026-11-26.txt).
