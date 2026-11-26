# Checkpoint 2 · Kịch bản demo cho supervisor (bản nháp)

Theo trang 24 kế hoạch CP2. Thời lượng 12-15 phút. Ngày giờ do thầy xác nhận trong tuần 30/11-06/12 (O-CP2-05), tài liệu này không coi giờ đề xuất là đã chốt. Bản chạy: commit đóng băng ghi ở HO-05 (hiện `dba9f94`, chưa đủ UI).

## 1. Chuẩn bị (trước buổi ít nhất 30 phút)

| Việc | Người | Đã sẵn sàng? |
| --- | --- | --- |
| Stack chạy từ `Checkpoint2_Runbook.md`, `stack:ps` healthy, AI model tải sẵn, không cần Internet | Hoàng Anh | Chưa |
| Ba profile trình duyệt tách biệt: REPORTER, MANAGER, STAFF A (đã xác minh, cấp vai đúng quy trình) | Hoàng Anh | Chưa (thiếu quy trình cấp STAFF, QA-05) |
| Dữ liệu workflow riêng: chưa có phiếu nào cùng tên | Dương | Chưa |
| Dữ liệu merge riêng: hai phiếu SUBMITTED của đèn H2-04, cùng đối tượng/lần hỏng, chưa giao | Sơn | Chưa |
| Ảnh demo không có người/biển số, ghi rõ là diễn tập | Dương | Chưa |
| Video và ảnh/log dự phòng của cả hai kịch bản | Hoàng Anh | Chưa |
| Không chiếu `.env`, mật khẩu, token | Cả nhóm | |

## 2. Kịch bản

| Phút | Người / thao tác | Phải chứng minh | Phụ thuộc chưa có |
| --- | --- | --- | --- |
| 1 | Hải Anh: CP1 có gì, CP2 thêm gì, ba vai, commit đang chạy, phần chưa xong | Rõ bản chạy và phạm vi | |
| 2 | Dương (REPORTER): tạo `[CP2-DEMO] Đèn H2-03 không sáng` ở A1 / tầng 2 / hành lang, đính ảnh | Gợi ý không tự gộp; Report lưu nguyên văn và đúng ảnh | Form chọn ảnh (QA-02) |
| 2 | Sơn (MANAGER): tiếp nhận, ELECTRICAL, ưu tiên, hạn, giao STAFF A | STAFF A nhận đúng việc; lịch sử actor/time | |
| 2 | Dương (STAFF A): start, ghi tiến độ/vật tư, nộp ảnh + ghi chú | Không tự đóng được; AWAITING_REVIEW | Màn STAFF (QA-01) |
| 1-2 | Sơn trả lại có lý do; Dương nộp lại; Sơn xem ảnh và đóng | History và ảnh cũ được giữ | Màn STAFF (QA-01) |
| 2 | Sơn: mở hai phiếu H2-04, so sánh, gộp, xem nguồn ở đích, hủy gộp, rà lại nguồn | Report trước/sau không đổi; nguồn reviewRequired; quan hệ một tầng; event đủ | Nút gộp/hủy/rà lại (QA-03) |
| 2 | Thành Lê + Công Thành: một positive, một negative khác bóng cùng hành lang, một ca không chắc; bảng kết quả và model runtime | Số mẫu, ngôn ngữ, nguồn nhãn; AI chỉ gợi ý | Chốt runtime (O-CP2-04) |
| 1 | Hoàng Anh: kết quả QA theo `Checkpoint2_Test_Report.md`; Hải Anh tổng kết đạt/chưa đạt | Có bằng chứng PASS/FAIL/NOT RUN | |

## 3. Đối chiếu trước/sau cho phần gộp

Ghi lại trước khi gộp và sau khi hủy gộp, cho cả hai phiếu: `description`, vị trí, người gửi, `createdAt`, danh sách photoId của Report, `status`, `version`. Hai lần phải trùng nhau ở các trường Report. Lưu vào `docs/qa-evidence/<ngày>_<commit>/demo-merge-before-after.md`.

## 4. Diễn tập

- HO-07 (29/11): dựng lại từ runbook trên máy sạch, chạy hai kịch bản hai lần trên bản cuối.
- Reset dữ liệu demo chỉ bằng seed/demo riêng có kiểm soát, không xóa DB làm việc, không `down -v`.
- Video chỉ dùng dự phòng khi trình bày; không dùng video để tính một chức năng chưa chạy là đạt.

## 5. Kế hoạch dự phòng

| Sự cố khi demo | Xử lý |
| --- | --- |
| AI không phản hồi | Cho thấy web báo unavailable và vẫn gửi được (A02), chuyển sang phần data |
| Phiên hết hạn | Đăng nhập lại trong profile đúng vai, không dùng phiên demo manager thay cho vai khác |
| Stack lỗi | Mở video và log dự phòng, nói rõ đây là bản ghi |
