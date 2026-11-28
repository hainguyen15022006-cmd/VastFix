# Sơn · Checkpoint 2, ngày 25–26/11/2026

Nhánh làm việc: `feat/cp2-manager-workflow-ui`. Đã merge `origin/feat/cp2-workflow-api` vào nhánh này để thử với API thật, không thay đổi schema hoặc API của Chúc. Phần mã của Chúc giữ nguyên lịch sử commit và tác giả. Chưa push.

## SO-03 · 25/11

- Trang chi tiết đọc API thật `GET /api/manager/issues/:id`, danh sách nhân viên xác minh từ `GET /api/manager/staff`, danh mục từ `GET /api/report-options`.
- SUBMITTED: chọn category có trong DB, P0/P1/P2 và hạn giờ Việt Nam; POST `triage` với ISO 8601 và `expectedVersion`.
- TRIAGED: chọn STAFF được API trả về; POST `assign` với `expectedVersion`.
- ASSIGNED/IN_PROGRESS: có thể trả về triage với lý do. Sau mỗi mutation thành công, tải lại chi tiết; quay về queue sẽ tải lại danh sách.
- Lỗi 400 hiển thị yêu cầu sửa dữ liệu; lỗi 409 hiển thị xung đột và tải lại detail. 401/403/404/503 có thông báo riêng, không lộ nội dung lỗi nội bộ.

## SO-04 · 26/11

- AWAITING_REVIEW: hiển thị ghi chú hoàn thành và ảnh của event WORK_SUBMITTED mới nhất. Chỉ bật duyệt/đóng sau khi quản lý xác nhận đã xem ảnh; POST `close` với `evidenceReviewed: true`. Có thể POST `return-work` với lý do.
- CLOSED: POST `reopen` với lý do. Mọi mutation gửi `expectedVersion` hiện tại và tải lại phiếu sau khi thành công.
- Tab gộp có nhập mã nguồn, tải detail nguồn, so sánh mô tả/vị trí/trạng thái với phiếu đích, nhập lý do và xác nhận. Nút gửi gộp đang **disabled** vì remote hiện chưa có endpoint merge/reverse của Hải Anh. Chưa thể xác nhận hoàn tất mutation gộp hoặc quyền ảnh sau gộp/hủy gộp.

## Bàn giao cho nhóm

- Hải Anh: cung cấp route, body, merge guard, response/error cho thao tác gộp; xác nhận quyền ảnh sau gộp/hủy gộp. Khi có route, nối nút gộp với POST nguồn/đích/lý do và reload cả queue/detail.
- Dương: dùng `ProtectedPhotoViewer` để xem ảnh theo quyền; nộp WORK_SUBMITTED với `completionNote` và `evidencePhotoIds` hợp lệ để quản lý duyệt.
- Chúc: xác nhận API workflow merge vào nhánh chung; kiểm tra `expectedVersion` và lỗi 409 sau khi tích hợp phần upload/merge.

Phạm vi ngày 27–29/11 chưa thực hiện trong đợt này.
