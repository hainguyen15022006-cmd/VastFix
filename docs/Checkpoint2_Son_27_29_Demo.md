# Sơn · Checkpoint 2, ngày 27–29/11/2026

## SO-05 · Nguồn gộp, hủy gộp, rà lại

- Tab Quan hệ gộp hiển thị từng nguồn liên quan với mã phiếu, mô tả gốc, vị trí và liên kết mở chi tiết. Báo cáo gốc vẫn được hiển thị riêng ở tab Báo cáo gốc.
- Phiếu nguồn có `mergedIntoIssueId` hiển thị liên kết tới đích và khóa workflow. Phiếu `reviewRequired` hiển thị cảnh báo, ô lý do rà lại và khóa workflow.
- So sánh nguồn/đích hủy request cũ khi người dùng đổi mã, tải lại hoặc rời trang; mã nguồn trùng đích và mã sai định dạng bị từ chối.
- Nút gộp, hủy gộp và rà lại nguồn giữ disabled. Remote được fetch ngày 26/11 chưa có API merge/reverse/review; detail DTO cũng chưa có `mergeId` để hủy đúng quan hệ. Chưa thể chạy luồng gộp → hủy → rà lại trên DB thật.

## SO-06 · QA cần thực hiện

1. Mở hàng đợi bằng tài khoản MANAGER ở `/vi/manager/issues`. Chọn từng trạng thái, mở tóm tắt bằng bàn phím, Escape đóng hộp thoại; đổi phiếu không được thấy thông tin phiếu cũ.
2. Mở chi tiết, chuyển các tab bằng bàn phím; thử tải lại khi danh sách/chi tiết đang tải. Kiểm 401/403/404, 409 sau mutation, payload sai 400, timeout và ảnh không có quyền.
3. So sánh nguồn/đích: mã trùng, mã sai, phiếu không tồn tại và đổi nguồn trong khi tải. Luôn kiểm ID nguồn/đích ở đầu màn hình trước khi bật thao tác ghi.
4. Lặp lại bằng `/en/manager/issues` và viewport điện thoại. Mô tả người dùng giữ nguyên ngôn ngữ gốc.
5. Khi API merge có mặt: kiểm modal xác nhận, focus/Tab/Escape, POST đúng source/target, refresh sau ghi, quan hệ sau relogin, reverse theo mergeId, reviewRequired và quyền ảnh sau hủy.

## SO-07 · Kịch bản MANAGER (chỉ chạy bước có API)

**Luồng 1 — tiếp nhận và duyệt:** REPORTER gửi phiếu → MANAGER lọc SUBMITTED, mở chi tiết, tiếp nhận với loại/ưu tiên/hạn → phân công STAFF → STAFF bắt đầu, ghi tiến độ và nộp ghi chú/ảnh → MANAGER xem ảnh, xác nhận đã xem, đóng hoặc trả lại với lý do → tải lại/relogin để kiểm trạng thái lưu.

**Luồng 2 — quan hệ gộp:** MANAGER chọn phiếu đích → nhập ID nguồn và so sánh mô tả/vị trí → nhập lý do, xác nhận → gộp → kiểm nguồn xuất hiện ở đích và nguồn liên kết tới đích → hủy theo mergeId → mở nguồn `reviewRequired`, rà lại → kiểm ảnh và trạng thái trước/sau. **Các bước ghi của luồng 2 chờ API Hải Anh; không dùng ảnh fixture để chứng minh DB thật.**

## Bằng chứng và bàn giao

- Gửi cho Hoàng Anh: nhánh/commit frontend, hướng dẫn hai luồng, danh sách bước nào đã kiểm thật, giới hạn merge CP2.
- Gửi cho Hải Anh: cần endpoint/body/response/error cho merge, reverse, review; bổ sung `mergeId` cho nguồn liên quan trong detail; xác nhận merge guard và quyền ảnh.
- Gửi cho Dương: cần WORK_SUBMITTED có `completionNote`, `materials` nếu có, và ảnh để kiểm duyệt trên dữ liệu thật.
- Ảnh trước/sau gộp chưa chụp được từ DB thật vì API gộp chưa có. Chụp sau khi bản chung có endpoint và fixture dữ liệu hợp lệ.
