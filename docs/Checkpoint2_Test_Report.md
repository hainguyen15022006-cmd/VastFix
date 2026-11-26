# Checkpoint 2 · Báo cáo kiểm thử QA (bản nháp)

Người giữ bảng: Hoàng Anh (Tích hợp/QA). Trạng thái: **nháp lần 2, 27/11/2026 00:05 giờ Việt Nam**. Bảng này theo các ca bắt buộc ở trang 22-23 kế hoạch CP2. Chỉ ghi PASS khi đã chạy và có bằng chứng; phần chưa chạy ghi NOT RUN, không suy ra từ test CP1.

## 1. Bản được kiểm

| Mục | Giá trị |
| --- | --- |
| Nhánh QA | `test/cp2-integration-qa` |
| Commit bản ghép được test | `dba9f94` (merge `feat/cp2-manager-workflow-ui` vào `feat/cp2-photo-storage`) |
| Thành phần | `feat/cp2-workflow-api` 11809a6 (Chúc) · `feat/cp2-photo-storage` 80fbe7b (Hải Anh) · `feat/cp2-manager-workflow-ui` 21c4491 (Sơn) · nền `main` 6e33c1b |
| Xung đột khi ghép | Không có. Không sửa code của thành viên. |
| Môi trường E1 | Linux x64 sạch (container), Node 24.22.3, npm 11, PostgreSQL 17 tạm qua `embedded-postgres`, Google Chrome cho Playwright, Python 3.13 cho ai-service |
| Môi trường E2 | Docker Compose stack trên máy Windows của nhóm: **chưa chạy cho bản CP2** |
| Bằng chứng | [`docs/qa-evidence/2026-11-27_dba9f94/`](qa-evidence/2026-11-27_dba9f94/) |

Chưa có trên các nhánh remote ngày 26/11: màn hình STAFF, form báo cáo có tải ảnh, nút gộp/hủy gộp/rà lại nguồn trên UI quản lý (nút gộp vẫn disabled dù API đã có). Các phần UI tương ứng ghi NOT RUN.

## 2. Suite tự động đã chạy (E1, commit dba9f94)

| Lệnh | Kết quả | Thời gian | Log |
| --- | --- | --- | --- |
| `npm run typecheck` | PASS | | `typecheck.log` |
| `npm run build` | PASS, đủ route CP2: manager/staff issues, staff, merges, reverse, uploads, photos | | `build.log` |
| `node scripts/check-workflow-api.mjs` | PASS (1 nhóm tổng) | 14 s | `workflow.log` |
| `npm run test:photos` | PASS 9/9 nhóm | 15 s | `photos.log`, `photo-api-verification.json` |
| `npm run test:merges` | PASS 11/11 nhóm | 15 s | `merges.log`, `merge-api-verification.json` |
| `npm run test:reporter-flow` | PASS 7/7 nhóm | 5 s | `reporter-flow.log` |
| `npm run test:ui` (Chrome) | PASS 46/46 | 30 s | `ui.log` |
| `pytest ai-service/tests` | PASS 14/14 | 1 s | `ai-pytest.log` |
| `npm run check:integration -- --fallback --auth` | NOT RUN: cần Docker stack (E2) | | |
| `npm run check:stack-browser` | NOT RUN: cần Docker stack (E2) | | |

Ghi chú về phạm vi: các suite API dùng Better Auth thật, PostgreSQL 17 tạm và `next start` production. `check-workflow-api.mjs` chèn metadata ảnh và quan hệ gộp bằng SQL fixture; theo checklist trang 20, phần gộp chỉ được tính PASS từ `test:merges` (gọi API merge/reverse thật). 15 ca `manager-workflow-fixture.spec.ts` mock response API: chỉ chứng minh UI gửi đúng payload, không chứng minh DB.

## 3. Bảng ca kiểm thử

Cột Lớp: **API** là HTTP + DB thật qua script; **UI** là trình duyệt trên stack thật với tài khoản thật. Một ca chỉ được tính đạt toàn phần khi cả hai lớp PASS.

### 3.1 Workflow và quyền (trang 22)

| ID | Lớp | Commit / MT | Bước | Expected | Actual | Kết quả | Bằng chứng | Owner sửa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | API | dba9f94 / E1 | REPORTER upload ảnh REPORT, gửi Report với `photoIds`; đọc lại | Đúng 1 Report, Issue SUBMITTED, event; ảnh gắn bất biến | Gắn ảnh nguyên tử, đúng owner, ảnh không đổi sau gửi; tranh chấp dùng ảnh chỉ thành công 1 lần | PASS | photos.log nhóm 3, 8; reporter-flow.log | Hải Anh + Chúc |
| W01 | UI | | Form báo sự cố có chọn ảnh, reload | Như trên qua UI | Form CP1 chưa có chọn ảnh | NOT RUN | | Dương |
| W02 | API | dba9f94 / E1 | MANAGER triage (dueAt sai ngày, field lạ, hợp lệ) rồi assign | 400 với dữ liệu sai; TRIAGED; ASSIGNED; event đúng actor | Đúng như expected; assign cho REPORTER bị 400 | PASS | workflow.log | Chúc + Sơn |
| W02 | UI | dba9f94 / E1 (mock) | Playwright triage/assign với fixture | Gửi `expectedVersion`, reload detail | 46/46 PASS nhưng mock API | NOT RUN (UI thật) | ui.log #25, #27 | Sơn |
| W03 | API | dba9f94 / E1 | STAFF B đọc list/detail/start phiếu của A; REPORTER gọi staff/manager list | B list rỗng, detail/start 404; REPORTER 403; không phiên 401 | Đúng như expected | PASS | workflow.log | Chúc + Hải Anh |
| W03 | UI | | Hai profile trình duyệt STAFF A/B | B không thấy việc A | Chưa có màn STAFF | NOT RUN | | Dương |
| W04 | API | dba9f94 / E1 | STAFF A start, progress với ghi chú có dấu + xuống dòng, vật tư | IN_PROGRESS; nội dung giữ nguyên sau đọc lại | `"Kiểm dây\nĐã ngắt điện"` giữ nguyên trong history | PASS | workflow.log | Chúc + Dương |
| W04 | UI | | | | Chưa có màn STAFF | NOT RUN | | Dương |
| W05 | API | dba9f94 / E1 | Submit thiếu ảnh, ảnh không tồn tại, ảnh STAFF B, ảnh Issue khác, sai purpose, chưa lưu; thiếu bảng ảnh | 400 (503 khi thiếu storage); version không đổi | Đúng như expected, rollback giữ version | PASS | workflow.log; photos.log nhóm 4 | Chúc + Hải Anh |
| W05 | UI | | | | Chưa có màn STAFF | NOT RUN | | Dương |
| W06 | API | dba9f94 / E1 | Submit hợp lệ; return-work lý do rỗng rồi hợp lệ; nộp lại ảnh cũ, ảnh mới | AWAITING_REVIEW; 400 lý do rỗng; IN_PROGRESS; ảnh cũ không dùng lại; lịch sử giữ 2 lượt | Đúng như expected | PASS | workflow.log; photos.log nhóm 6 | Chúc + Dương + Sơn |
| W06 | UI | | Quản lý xem ảnh rồi trả lại | | UI quản lý có return-work (mock PASS), phần STAFF nộp lại chưa có | NOT RUN | ui.log #29 | Dương + Sơn |
| W07 | API | dba9f94 / E1 | Close thiếu `evidenceReviewed`; STAFF close; close hợp lệ; close lần 2 | 400; 403; CLOSED + closedAt; 409 | Đúng như expected | PASS | workflow.log | Chúc + Sơn |
| W07 | UI | | | | Mock PASS (#26), chưa chạy với stack thật | NOT RUN | | Sơn |
| W08 | API | dba9f94 / E1 | Reopen có lý do; STAFF A cũ đọc phiếu | TRIAGED, closedAt null, assignee null; STAFF A 404; quyền ảnh của người giao cũ bị thu hồi | Đúng như expected | PASS | workflow.log; photos.log nhóm 6 | Chúc |
| W08 | UI | | | | Mock PASS (#30) | NOT RUN | | Sơn |
| W09 | API | dba9f94 / E1 | Hai request assign cùng version (A và B) | Một 200, một 409; 1 event ISSUE_ASSIGNED | Đúng như expected. Close song song chỉ kiểm dạng reverse vs close (merges nhóm 11) | PASS (assign) / NOT RUN (close hai tab) | workflow.log; merges.log | Chúc + Hải Anh |
| W10 | UI | | Hết phiên / đổi vai khi đang mở màn | Request sau bị từ chối, UI xóa dữ liệu | Chỉ có ca reporter hết phiên giữ nháp (#42, mock) | NOT RUN | | Hải Anh + FE |
| W11 | API | dba9f94 / E1 | 26 phiếu, trang 1 và cursor; lọc status sai | 25 mục + nextCursor, trang 2 không trùng; 400 | Đúng như expected | PASS | workflow.log | Chúc |
| W11 | UI | | Lỗi tải tiếp, refresh | | Chưa chạy | NOT RUN | | FE |
| W12 | UI | dba9f94 / E1 (mock) | /en mobile form báo cáo | Nhãn, lỗi, viewport đúng | Form reporter /en mobile PASS (#45). Màn CP2 vi/en, modal, mobile chưa kiểm | NOT RUN (màn CP2) | ui.log | Dương + Sơn |

### 3.2 Merge, ảnh và AI (trang 23)

| ID | Lớp | Commit / MT | Bước | Expected | Actual | Kết quả | Bằng chứng | Owner sửa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | API | dba9f94 / E1 | POST /manager/merges A→B | Event hai bên; A ẩn khỏi queue và AI candidates; B thấy Report của A; Report gốc không đổi | Đúng như expected (so snapshot bảng Report) | PASS | merges.log nhóm 2 | Hải Anh + Sơn |
| M01 | UI | | | | Nút gộp disabled trong UI | NOT RUN | ui.log #32 | Sơn |
| M02 | API | dba9f94 / E1 | A→A, trùng, chuỗi, vòng, nguồn/đích đã giao | Đều bị chặn | Đúng như expected | PASS | merges.log nhóm 1, 3 | Hải Anh |
| M03 | API | dba9f94 / E1 | Gộp đồng thời cùng nguồn, chuỗi, vòng; gộp vs assign | 1 thành công, 1 409; không quan hệ mồ côi | Đúng như expected | PASS | merges.log nhóm 6-9 | Hải Anh |
| M04 | API | dba9f94 / E1 | Reverse đúng mergeId sau khi đích CLOSED; reverse lần 2 | Giữ log, nguồn reviewRequired, không nhận kết quả của đích; không ghi lặp | Đúng như expected | PASS | merges.log nhóm 4, 10 | Hải Anh + Sơn |
| M05 | API | dba9f94 / E1 | Nguồn sau reverse thử assign; review-after-unmerge; quyền ảnh nguồn | Chặn tới khi review; đích đóng giữ dữ liệu; quyền ảnh tính lại | Đúng như expected | PASS | merges.log nhóm 4; photos.log nhóm 5 | Hải Anh + Chúc |
| M04-M05 | UI | | Hủy gộp, rà lại nguồn trên màn quản lý | | Chưa có UI | NOT RUN | | Sơn |
| P01 | API | dba9f94 / E1 | Upload JPEG/PNG/WebP thật; MIME giả, ảnh hỏng, quá lớn, field lặp; SVG | Lưu ảnh hợp lệ, chặn còn lại; không thoát thư mục | Đúng như expected; sửa đường dẫn trong DB không đọc được tệp ngoài storage | PASS | photos.log nhóm 1, 2, 7 | Hải Anh + Dương |
| P02 | API | dba9f94 / E1 | Không phiên, người báo khác, STAFF không được giao đọc ảnh | Bị từ chối; người có quyền đọc đúng ảnh | Đúng như expected; header `private, no-store` | PASS | photos.log nhóm 2, 4, 6 | Hải Anh |
| P03 | Stack | | `stack:down` rồi `stack:up` không `-v`; upload lỗi rồi thử lại | Report và ảnh còn; không Report trùng | Chưa chạy stack CP2 (Hải Anh có thử --force-recreate web ngày 26/11, chưa phải QA độc lập) | NOT RUN | | Hoàng Anh + Hải Anh |
| A01 | API | dba9f94 / E1 (AI fixture) | Gợi ý trùng sau gộp và sau reverse | Nguồn gộp bị loại trước khi gọi AI; reverse xuất hiện lại | Đúng với AI fixture ghi candidate IDs; AI thật chưa chạy | PASS (lọc candidates) / NOT RUN (AI thật) | merges.log nhóm 2, 4 | Chúc + Thành Lê |
| A02 | Stack | | Dừng service ai, timeout, model lỗi | Web báo unavailable, vẫn gửi được | Ca CP1 FB-01 đạt 21/11; chưa chạy lại trên bản CP2. Runtime/version model CP2 chưa chốt (O-CP2-04) | NOT RUN | | Thành Lê + Chúc |
| I01a | Build | dba9f94 / E1 | DB mới + toàn bộ migration + seed; typecheck, build, suite | Đạt | Đạt trên DB tạm Linux sạch | PASS | các log ở mục 2 | Hoàng Anh + Hải Anh |
| I01b | Stack | | DB nâng cấp từ CP1 (volume cũ) qua service migrate | Migration photo_storage áp, dữ liệu cũ giữ | Hải Anh báo đã áp trên DB cổng 5434 có checksum; QA chưa chạy độc lập | NOT RUN | | Hoàng Anh |
| I01c | Máy thứ hai | | Windows của nhóm, `npm ci` + stack | Đạt | Chưa chạy | NOT RUN | | Hoàng Anh |
| D01 | Data | | Evaluator trên dataset ghim | | Ngoài phạm vi lần này | NOT RUN | | Công Thành + Thành Lê |

Chưa kiểm và chưa có kế hoạch kiểm trong CP2: tải lớn, Safari, iOS thật.

## 4. Tổng hợp

| | PASS | FAIL | NOT RUN |
| --- | --- | --- | --- |
| Lớp API/build (E1) | 19 ca | 0 | 2 phần (close hai tab, AI thật) |
| Lớp UI thật và Stack | 0 | 0 | toàn bộ |

Chưa có FAIL ở lớp API. CP2 **chưa đạt nghiệm thu** vì luồng demo chính cần UI STAFF, upload ảnh trên form và nút gộp/hủy gộp, và stack Docker chưa được QA chạy.

## 5. Vấn đề mở và người nhận

| Mã | Mô tả | Mức | Owner | Hạn đề xuất |
| --- | --- | --- | --- | --- |
| QA-01 | Chưa có màn STAFF (start/progress/upload ảnh/submit). Chặn W03-W06 UI và kịch bản demo 1 | Blocker demo | Dương | 27/11 20:00 |
| QA-02 | Form báo cáo chưa gửi `photoIds`. Chặn W01 UI và demo bước 2 | Blocker demo | Dương | 27/11 20:00 |
| QA-03 | Nút gộp trong `manager-issue-detail.tsx` vẫn disabled; chưa có hủy gộp, review-after-unmerge trên UI dù API đã có ở 80fbe7b | Blocker demo | Sơn | 27/11 20:00 |
| QA-04 | Các nhánh CP2 chưa vào `main`; cần PR theo thứ tự workflow-api → photo-storage → manager-ui | Tích hợp | Hải Anh duyệt | 27/11 |
| QA-05 | Chưa có tài khoản STAFF A/B đã xác minh, cấp vai theo quy trình trên stack chung (HO-02) | Chặn test UI thật | Hoàng Anh + Hải Anh | 27/11 |
| QA-06 | `check-workflow-api.mjs` dùng SQL fixture cho quan hệ gộp và metadata ảnh; không dùng làm bằng chứng merge | Ghi chú | Chúc | Không chặn |
| QA-07 | Model runtime, timeout, threshold chưa chốt (O-CP2-04, hạn 27/11 20:00) | Chặn A01/A02 | Thành Lê + Công Thành | 27/11 20:00 |

## 6. Lịch chạy lại

- HO-05 (27/11, sau 20:00): ghép bản đóng băng, chạy lại mục 2 và các dòng UI khi QA-01..03 có PR.
- HO-06 (28/11): chạy toàn bảng trên stack Docker với tài khoản thật từng vai, restart P03, AI-off A02, vi/en W12, máy thứ hai I01c.
- HO-07 (29/11): dựng lại demo từ `Checkpoint2_Runbook.md`, chạy hai kịch bản hai lần.
