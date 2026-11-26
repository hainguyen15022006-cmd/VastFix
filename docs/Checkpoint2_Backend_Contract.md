# CP2 - hợp đồng bổ sung backend

Ngày triển khai: 26/11/2026. Nhánh bàn giao: `feat/cp2-photo-storage`, kế thừa workflow của Chúc `11809a6`. Đây là mô tả hành vi đã triển khai để nhóm đọc và nối giao diện; không thay đặc tả cuối kỳ hay biên bản supervisor nghiệm thu.

API v1 giữ nguyên. Mọi request dùng phiên; UUID; web camelCase; thời gian ISO 8601 có timezone, lưu UTC, hiển thị giờ Việt Nam. Actor lấy từ phiên và vai hiện hành trong DB. Tham khảo [API ảnh](Photo_API_CP2.md), [workflow](Checkpoint2_Workflow_API.md), [ERD/trạng thái](Checkpoint2_ERD_State.md).

## 1. Gộp một nguồn vào một đích

`POST /api/manager/merges`, chỉ MANAGER.

```json
{
  "sourceIssueId": "<UUID nguồn>",
  "targetIssueId": "<UUID đích>",
  "expectedSourceVersion": 1,
  "expectedTargetVersion": 1,
  "reason": "Đã đối chiếu cùng thiết bị và cùng lần hỏng"
}
```

Điều kiện CP2: cả hai SUBMITTED/TRIAGED, chưa có assignee, không reviewRequired; đích không đang là nguồn của lần gộp khác; nguồn không có con đang gộp vào. Một đích nhận nhiều nguồn bằng các lần gọi riêng, tải lại version của đích sau mỗi lần. Không tự gộp, gộp lặp, chuỗi hoặc vòng. Khác vị trí/loại không tự chứng minh trùng; quản lý phải đối chiếu và ghi lý do.

HTTP 201, khung response:

```json
{
  "merge": {
    "id": "<UUID lần gộp>",
    "mergeId": "<cùng UUID lần gộp>",
    "sourceIssueId": "<nguồn>",
    "targetIssueId": "<đích>",
    "mergedByUserId": "<quản lý>",
    "mergedAt": "<ISO 8601>",
    "reason": "<lý do>",
    "reversedAt": null,
    "reversedByUserId": null
  },
  "issues": {
    "source": { "issueId": "<nguồn>", "status": "SUBMITTED", "reviewRequired": false, "version": 2 },
    "target": { "issueId": "<đích>", "status": "SUBMITTED", "reviewRequired": false, "version": 2 }
  },
  "requestId": "<UUID request>"
}
```

Không đổi Report, ảnh, originReportId, category, priority, dueAt hoặc trạng thái gốc của hai phiếu. Source ẩn khỏi hàng đợi mặc định và tập ứng viên AI, khóa xử lý công việc. Detail của đích truy vấn Report liên quan qua IssueMerge. Mỗi phía có event `ISSUE_MERGED` chứa mergeId, sourceIssueId, targetIssueId, reason, side và from/to.

## 2. Hủy đúng một lần gộp

`POST /api/manager/merges/:mergeId/reverse`, chỉ MANAGER.

```json
{
  "expectedSourceVersion": 2,
  "expectedTargetVersion": 7,
  "reason": "Kiểm tra lại cho thấy hai đối tượng khác nhau"
}
```

Lấy version nguồn và đích mới nhất, kể cả đích đã xử lý hoặc đóng. HTTP 200 có khung `merge`, `issues`, `requestId` như trên và `reversalReason`. `merge.reversedAt`/`reversedByUserId` được ghi; lý do gộp ban đầu không bị thay. Lý do đảo lưu trong event hai phía `ISSUE_UNMERGED` và `reversalReason` của response.

Source giữ nguyên trạng thái/đánh giá/người xử lý/thời điểm của chính nó, đặt reviewRequired=true. Không sao chép kết quả sửa, ảnh hoàn thành hoặc trạng thái đóng từ đích. Đích giữ dữ liệu vận hành của mình. Các nguồn khác của đích không bị tách. Hủy lần thứ hai trả 409; không xóa lịch sử. Quyền ảnh được tính theo quan hệ hiện hành ở request tiếp theo.

## 3. Rà lại nguồn sau hủy gộp

`POST /api/manager/issues/:id/review-after-unmerge`, chỉ MANAGER.

```json
{
  "expectedVersion": 3,
  "categoryCode": "ELECTRICAL",
  "priority": "P1",
  "dueAt": "2026-12-01T12:00:00+07:00",
  "reason": "Đã kiểm tra và xác nhận cần xử lý riêng"
}
```

Chỉ phiếu nguồn đã hủy gộp, đang reviewRequired, không bị gộp lại, chưa giao việc và ở SUBMITTED/TRIAGED. Xác nhận loại/ưu tiên/hạn và lý do rồi đổi sang TRIAGED, reviewRequired=false; ghi `ISSUE_REVIEWED_AFTER_UNMERGE`. Response HTTP 200 `{issue, event, requestId}` theo workflow. Sau đó mới gọi `/assign` bằng version mới. Dùng `/triage` thường để vượt cờ reviewRequired sẽ bị chặn.

## 4. Đọc detail và sửa đánh giá

`GET /api/manager/issues/:id` bổ sung:

- `outgoingMerge`: null hoặc `{mergeId, id, sourceIssueId, targetIssueId, mergedAt, reason}` đang hiệu lực của nguồn; vẫn giữ `mergedIntoIssueId` cũ.
- `activeMerges`: danh sách cùng cấu trúc của các nguồn đang thuộc đích. FE dùng `mergeId` để hủy sau reload, không giữ id chỉ trong bộ nhớ.
- `mergeHistory`: lịch sử vào/ra, kể cả reversedAt; chỉ trả cho quản lý. Lý do đảo và actor nằm trong `history`.
- `reports[].location`: `{kind, detail, latitude, longitude, snapshot}` của từng Report; giữ nguyên `locationLabel` cũ. FE phải hiển thị detail nếu có để tìm đúng phòng/thiết bị.
- `history[].details` giữ các mã mergeId/sourceIssueId/targetIssueId/side cần để đọc nhật ký.

STAFF detail cũng nhận vị trí cụ thể và Report đang liên quan theo quyền, không nhận mergeHistory toàn bộ. Server kiểm quyền tệp riêng ở GET/HEAD ảnh.

`POST /api/manager/issues/:id/triage` nhận SUBMITTED hoặc TRIAGED (không reviewRequired). Vì vậy, quản lý có thể sửa loại/ưu tiên/hạn sau return-to-triage hoặc reopen. Request giữ các trường cũ; ghi event và tăng version kể cả TRIAGED → TRIAGED.

## 5. Phiên bản, giao dịch và lỗi

Version bằng số IssueEvent của phiếu. Mỗi merge/reverse tăng version cả hai phía một lần; review tăng nguồn một lần; upload nháp không tăng version workflow. Không xóa event. Workflow, merge, reverse và review dùng Serializable transaction và khóa hàng Issue; hai phiếu khóa theo thứ tự UUID ổn định. Merge/reverse ghi hàng Issue kể cả trạng thái không đổi để không dùng snapshot đồ thị cũ khi chờ khóa.

DB đã có unique index cho một source chỉ có một active merge và CHECK không tự gộp từ migration CP1. Quy tắc hình sao và trạng thái do service kiểm trong giao dịch. Không cần migration mới chỉ để thêm các endpoint gộp.

Lỗi JSON `{error:{code,message},requestId}`: 400 dữ liệu không hợp lệ; 401 thiếu phiên; 403 sai vai/Origin; 404 không tìm thấy; 409 `MERGE_CONFLICT`/`WORKFLOW_CONFLICT` khi version hoặc trạng thái/đồ thị thay đổi. Không tự retry mutation; tải lại detail nguồn/đích rồi người dùng xác nhận lại. Các POST workflow có Origin thì phải khớp origin BETTER_AUTH_URL; công cụ API có cookie được phép không gửi Origin. API upload/xóa ảnh yêu cầu Origin theo hợp đồng ảnh.

Hạn dueAt do quản lý xác nhận trong CP2. Lịch SLA P0/P1/P2, cảnh báo/thông báo và các chức năng cuối kỳ vẫn nằm trong backlog đã chốt, chưa được coi là hoàn thiện bởi phần backend này.
