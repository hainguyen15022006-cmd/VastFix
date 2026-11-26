# Sơn · Checkpoint 2, phần 23–24/11/2026

Nhánh: `feat/cp2-manager-workflow-ui`, tách từ `main` CP1. Phạm vi SO-01 và SO-02. Bản API tham chiếu là tài liệu **đề xuất** trên `origin/feat/cp2-workflow-api` commit `11809a6`; kế hoạch CP2 không tự xác nhận contract đã khóa. Không đổi schema/API của người khác.

## SO-01 · Wireframe và action/status

```text
Hàng đợi: [Trạng thái: 6 lựa chọn] [Tìm trong trang đã tải] [Làm mới]
  Hàng phiếu: tóm tắt | vị trí | trạng thái | ngày tạo | Xem tóm tắt | Mở chi tiết

Chi tiết phiếu: [Về hàng đợi] [Mã phiếu] [Tải lại]
  [Badge trạng thái] [version] [ngày tạo] [cảnh báo reviewRequired / nguồn đã gộp]
  [Báo cáo gốc] [Xử lý] [Ảnh] [Lịch sử] [Quan hệ gộp]
  Xử lý: loại | ưu tiên | hạn | nhân viên | trạng thái kế tiếp
```

| Trạng thái/điều kiện | Hành động của MANAGER dự kiến | Endpoint đề xuất |
| --- | --- | --- |
| SUBMITTED | Tiếp nhận, xác nhận category/priority/dueAt | `triage` |
| TRIAGED | Giao STAFF hợp lệ | `assign` |
| ASSIGNED hoặc IN_PROGRESS | Xem tiến độ; có lý do thì đưa về TRIAGED | `return-to-triage` |
| AWAITING_REVIEW | Xem minh chứng, trả lại hoặc đóng | `return-work`, `close` |
| CLOSED | Mở lại với lý do | `reopen` |
| Nguồn đang gộp | Khóa action, liên kết tới đích | merge của Hải Anh |
| `reviewRequired` | Rà nguồn sau hủy gộp | review-after-unmerge của Hải Anh |

`MERGED` không được thêm vào enum IssueStatus. Quan hệ gộp dùng `mergedIntoIssueId` và `reports`. Báo cáo gốc vẫn là mục riêng; mô tả không dịch. Chi tiết không được suy diễn từ summary của hàng đợi.

## SO-02 · Handoff giao diện

- Queue chọn sáu trạng thái theo `GET /api/manager/issues?status=...`; đổi trạng thái hủy request cũ, giữ phân trang theo cursor. Backend CP1 chỉ nhận SUBMITTED, nên các trạng thái khác cần nhánh API CP2 để có dữ liệu.
- Route `/vi/manager/issues/[id]` và `/en/manager/issues/[id]` đọc `GET /api/manager/issues/:id?locale=...`. Năm phần: Report gốc, xử lý, ảnh, lịch sử, quan hệ gộp. Dùng `version`, priority, dueAt, assignee, reviewRequired và các event của DTO đề xuất.
- `src/components/shared/protected-photo-viewer.tsx` là viewer dùng chung cho Dương: fetch ảnh bằng cookie cùng origin, MIME JPEG/PNG/WebP, URL blob được thu hồi khi unmount. Có loading và lỗi quyền/tải. Không dùng URL ảnh công khai.
- Chuỗi `ManagerDetail` và `Queue.openDetail` có cả `messages/vi.json` và `messages/en.json`. Kiểu alert, loading nằm trong `src/app/globals.css`. Dương có thể import viewer; tránh sửa cùng shared file và dịch cùng lúc.
- Form categoryCode, priority, dueAt, assigneeId là khung tương tác cục bộ; nút lưu disabled có nhãn. Chưa gọi POST trước phần SO-03 ngày 25/11 và chưa tuyên bố mutation chạy thật. Danh sách assignee đọc `GET /api/manager/staff` khi API có sẵn.
- Trạng thái 401, 403, 404, lỗi mạng/response sai có thông báo và nút thử lại; không hiển thị thông điệp lỗi thô từ server. UI fixture trong `tests/ui/manager-workflow-fixture.spec.ts` không tạo endpoint giả trong sản phẩm.

## Cần Hải Anh/Chúc xác nhận trước khi nối mutation

1. `Checkpoint2_Workflow_API.md` có được hai owner khóa chính thức chưa? Các field nullable, `reports` và `history` có giữ dạng trong commit `11809a6` không?
2. Nguồn category hợp lệ cho form triage: dùng `GET /api/report-options` hiện tại hay endpoint quản lý mới? Form đang giữ text `categoryCode` để không đoán danh mục.
3. `dueAt` là thời gian có múi giờ; UI cần chuyển từ giờ Việt Nam sang ISO khi gửi. Quy tắc hạn vẫn cần xác nhận.
4. Ảnh và merge/reverse/review thuộc Hải Anh; viewer cần API ảnh thực để kiểm tra quyền sau hủy gộp.

Theo kế hoạch, SO-03/04 là việc ngày 25–26/11; không nằm trong đợt này. Không push hoặc mở PR khi chưa được Sơn yêu cầu ở cuộc trao đổi này.

## Bổ sung SO-05/06/07 · 27–29/11

Xem `docs/Checkpoint2_Son_27_29_Demo.md` cho kịch bản MANAGER, kiểm thử và phụ thuộc API. Đã có danh sách nguồn gộp, form rà lại nguồn và so sánh nguồn/đích an toàn khi request đến trễ. Nút gộp/hủy/rà lại vẫn disabled vì remote chưa có API/mergeId. Chưa có ảnh trạng thái trước/sau từ DB thật.
