# CP2 - bàn giao phần backend của Hải Anh

Nhánh: `feat/cp2-photo-storage`. Commit `304c893` là phần ảnh đã bàn giao trước; phần gộp/rà lại và sửa workflow nằm ở commit tiếp theo trên cùng nhánh. Lấy commit mới nhất trên nhánh, tránh dùng một nửa bộ thay đổi.

## Ai nhận phần nào

| Thành viên | Đầu ra BE đã có để sử dụng | Việc tiếp theo của thành viên |
| --- | --- | --- |
| Hải Anh | Photo schema/migration/storage, quyền ảnh, merge/reverse/review, khóa/version chung, contract/ERD và kiểm thử | Rà tích hợp sau FE/AI/data push; tổng hợp gói review thầy |
| Chúc | Workflow đã nối cùng khóa Issue; sửa vị trí detail và triage TRIAGED; adapter ảnh giữ các tên trường đã dùng | Đọc lại contract, kiểm logic nghiệp vụ và cùng hỗ trợ FE; mọi mutation mới giữ cùng quy tắc version/event |
| Dương | Upload REPORT/WORK_EVIDENCE, photoIds, evidencePhotoIds, đọc/xóa ảnh nháp; staff detail có vị trí cụ thể | Nối form ảnh và màn nhân viên; giữ ghi chú/ảnh lần trước khi bị trả lại; chạy kiểm thử trên UI thật |
| Sơn | Detail activeMerges/outgoingMerge/mergeHistory; triage/assign/duyệt; merge/reverse/review-after-unmerge | Nối màn quản lý và hộp xác nhận source/target/lý do; reload lấy version hai phía khi 409 |
| Thành Lê | Nguồn gộp bị loại khỏi candidates, reverse đủ điều kiện xuất hiện lại; web/AI contract không đổi | Kiểm runtime mô hình và số đo thực; không tự gộp từ score |
| Công Thành | Ca khác đối tượng/cùng vị trí, nguồn bị gộp/đã đảo/đích đã đóng có kịch bản | Hoàn thiện nguồn dữ liệu và nhãn/đánh giá pilot, ghi riêng ca không chắc |
| Hoàng Anh | Các script test ảnh, merge, workflow và regression; hướng dẫn dựng stack có volume ảnh | Chạy lại trên bản nhóm sau khi có đủ FE, ghi PASS/FAIL/NOT RUN và bằng chứng UI |

## Chạy bản có dữ liệu sẵn

```bash
git fetch origin
git switch feat/cp2-photo-storage
git pull --ff-only
npm ci
npm run demo:env
npm run stack:up
```

Máy đã dùng nhánh cá nhân hoặc đang sửa dở thì commit/cất thay đổi và kiểm lại trước khi đổi nhánh; người làm FE có thể tích hợp nhánh backend vào nhánh của mình theo quy ước nhóm. Không reset DB hoặc xóa volume. Nếu Mailpit của máy đang dùng cổng 8026 thì giữ cấu hình đó khi chạy stack. Migrate container áp migration mới, không cần chạy migrate dev/reset trên DB dùng chung.

Kiểm thử độc lập: `npm run build`, `npm run test:photos`, `npm run test:merges`, `node scripts/check-workflow-api.mjs`, `npm run test:reporter-flow`; UI dùng `npm run test:ui` với Chrome và cấu hình auth theo runbook hiện có. Các script API dùng PostgreSQL tạm, không chạy trên DB nhóm. [Hợp đồng CP2](Checkpoint2_Backend_Contract.md) là dữ liệu FE cần nối; [ERD](Checkpoint2_ERD_State.md), [quyết định](Checkpoint2_Decisions.md) và [API ảnh](Photo_API_CP2.md) là tài liệu đi kèm.

## Hai kịch bản review

1. Người báo gửi mô tả và ảnh; quản lý tiếp nhận/phân công; nhân viên start, ghi tiến độ/vật tư, tải ảnh hoàn thành và submit; quản lý trả lại rồi duyệt đóng. Chứng minh đúng quyền, lưu bền sau reload và lịch sử.
2. Hai Report riêng của cùng thiết bị/lần hỏng; quản lý so sánh rồi gộp; xem Report gốc ở đích; hủy đúng mergeId, thấy nguồn reviewRequired; rà lại nguồn rồi phân công. Đối chiếu mô tả/vị trí/người gửi/thời điểm/ảnh giữ nguyên. Trình bày thêm ca hai bóng khác nhau không nên gộp và ca không chắc.

Hiện các luồng BE đã có kiểm thử HTTP/DB thật. Giao diện CP2 còn do Dương/Sơn triển khai; bản UI CP1 chỉ có form báo cáo và hàng đợi. Chưa coi full CP2 của cả nhóm hoàn thành cho đến khi UI/API/DB/AI tích hợp chạy đạt và nhóm có bằng chứng để supervisor đánh giá.

Kết quả kiểm chứng backend: [Checkpoint2_Backend_Verification_2026-11-26.txt](Checkpoint2_Backend_Verification_2026-11-26.txt). Hai phiếu diễn tập trên Docker có nhãn CP2-DEMO để đọc lịch sử; không phải sự cố khảo sát.
