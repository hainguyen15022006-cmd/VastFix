# CP2 - quyết định triển khai và phần còn mở

Ngày 26/11/2026. Quyết định triển khai theo phạm vi Hải Anh giao; nhóm kiểm lại khi nhận bàn giao. Đây không phải xác nhận supervisor đã nghiệm thu CP2.

| Mã | Áp dụng trong bản chạy | Lý do / đầu mối |
| --- | --- | --- |
| D01 | Gộp hình sao một tầng; source/target SUBMITTED hoặc TRIAGED, chưa giao việc, không reviewRequired | Giữ phạm vi CP2 rõ ràng, không trộn công việc đang làm; Hải Anh/Chúc/Sơn |
| D02 | Hủy theo mergeId; không xóa record, không ghi đè lý do gộp | Có lịch sử và hủy đúng lần; Hải Anh/Sơn |
| D03 | Reverse nhận phiên bản cả nguồn/đích, kể cả đích đã đóng; source giữ dữ liệu và bị khóa reviewRequired | Tránh chép kết quả đóng sai sang nguồn; Hải Anh/Chúc |
| D04 | Review nguồn bắt buộc loại, ưu tiên, hạn và lý do; xong về TRIAGED | Không dùng một checkbox bỏ cờ để lách rà soát; Hải Anh/Sơn |
| D05 | Event count là version chung; Serializable + khóa Issue thống nhất thứ tự; mỗi bên gộp có event | Nối với workflow Chúc, chống thao tác đồng thời và snapshot cũ; hai BE |
| D06 | Detail có mergeId/history và vị trí detail/tọa độ/snapshot; triage nhận TRIAGED để sửa đánh giá | FE có đủ dữ liệu sau reload, xử lý hai lỗi review; Chúc/Sơn/Dương |
| D07 | Ảnh qua API riêng có quyền, 5 MB, tối đa 3 ảnh/lượt, 12 ảnh nháp/owner; mã hóa lại trước khi gắn Report | Giữ ảnh đã gửi bất biến, giới hạn dữ liệu tạm; Hải Anh/Dương |
| D08 | dueAt được quản lý nhập/xác nhận; chưa tự nhận lịch SLA là đã chốt | O9 về giờ làm việc/P0/P1/P2 cần xác nhận supervisor khi triển khai đầy đủ |

Phần còn mở sau CP2: thao tác gộp cho phiếu đã phân công/đang xử lý; cách dùng nhiều mô tả nguồn cho AI; follow/feedback; thông báo và SLA tự động; bản đồ/bộ lọc/danh mục/role UI đầy đủ; dữ liệu, phân loại và đánh giá cuối kỳ. Không tự cắt các yêu cầu supervisor đã duyệt.

Ảnh nháp bỏ quên vẫn cần cơ chế dọn theo tuổi; hiện có DELETE cho FE xóa ảnh không dùng. Việc dọn sau sự cố giữa file và DB cần quy trình đối soát, chưa có lịch tự động. Đây không ảnh hưởng tính bất biến của ảnh đã nộp.
