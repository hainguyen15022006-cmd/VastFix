# [CP2] Báo cáo tích hợp lần 2 · Hoàng Anh · 26/11 (HO-04)

Chạy lúc 27/11/2026 00:04 giờ Việt Nam (trễ hạn 22:30 ngày 26/11). Dùng tệp này làm mẫu cho các lần sau: giữ nguyên các mục, thay số liệu.

## 1. Bản ghép

| Thứ tự | Nhánh | Commit | Tác giả | Ghép |
| --- | --- | --- | --- | --- |
| 0 | `main` | 6e33c1b | | nền |
| 1 | `feat/cp2-workflow-api` | 11809a6 | Chúc | đã có trong 2 và 3 |
| 2 | `feat/cp2-photo-storage` | 80fbe7b | Hải Anh | nhánh gốc của bản QA |
| 3 | `feat/cp2-manager-workflow-ui` | 21c4491 | Sơn | merge, không xung đột |
| | **Bản chung** `test/cp2-integration-qa` | **dba9f94** | Hoàng Anh | |

Chưa có nhánh CP2 của: Dương (STAFF UI, form ảnh), Thành Lê/Công Thành (AI runtime CP2, dataset pilot).

## 2. Môi trường

Linux x64 sạch, Node 24.22.3, PostgreSQL 17 tạm (`embedded-postgres`), Chrome, Python 3.13. Không dùng Docker stack trong lần này.

## 3. Kết quả

| Kiểm tra | Kết quả |
| --- | --- |
| typecheck, build | PASS |
| check-workflow-api | PASS |
| test:photos | PASS 9/9 |
| test:merges | PASS 11/11 |
| test:reporter-flow | PASS 7/7 |
| test:ui | PASS 46/46 (15 ca CP2 mock API) |
| ai-service pytest | PASS 14/14 |
| check:integration, check:stack-browser, restart P03, AI-off A02 | NOT RUN (cần stack) |
| UI thật với tài khoản từng vai | NOT RUN (thiếu màn STAFF, form ảnh, nút gộp) |

Chi tiết từng ca: `docs/Checkpoint2_Test_Report.md`. Log: `docs/qa-evidence/2026-11-27_dba9f94/`.

## 4. Lỗi và blocker

| Mã | Mô tả | Bước tái hiện | Expected / Actual | Owner | Hạn |
| --- | --- | --- | --- | --- | --- |
| QA-01 | Chưa có màn STAFF | Đăng nhập STAFF, tìm trang việc được giao | Có trang / không có route `[locale]/staff` | Dương | 27/11 20:00 |
| QA-02 | Form báo cáo chưa gửi ảnh | Mở `/vi/reports/new` | Có chọn ảnh, gửi `photoIds` / không có | Dương | 27/11 20:00 |
| QA-03 | Nút gộp disabled, chưa có hủy gộp/rà lại | Detail phiếu SUBMITTED, tab gộp | Gọi `POST /api/manager/merges` / nút disabled | Sơn | 27/11 20:00 |
| QA-05 | Chưa có quy trình cấp vai STAFF | Tìm script/API đổi vai STAFF | Có, ghi `UserRoleEvent` / chỉ có bootstrap MANAGER | Hải Anh | 27/11 |

Không có FAIL ở API.

## 5. Tin nhắn bàn giao (dán vào nhóm)

```
[CP2] Hoàng Anh / 26/11 / HO-04
Đã xong: ghép workflow-api (Chúc) + photo-storage (Hải Anh) + manager-ui (Sơn), không xung đột | Nhánh test/cp2-integration-qa, commit dba9f94
Đã kiểm: typecheck, build, workflow, photos 9/9, merges 11/11, reporter-flow 7/7, UI 46/46, AI 14/14 đều PASS. Stack Docker và UI thật NOT RUN. Bằng chứng: docs/qa-evidence/2026-11-27_dba9f94
Bàn giao cho: Dương (màn STAFF + form ảnh), Sơn (nối nút gộp/hủy gộp/rà lại), Hải Anh (quy trình cấp vai STAFF, duyệt PR vào main)
Tiếp theo: HO-05 ghép bản đóng băng sau 20:00 27/11, chạy stack + tài khoản thật
Vướng: QA-01/02/03 chặn demo; cần trả lời trước 27/11 20:00
```
