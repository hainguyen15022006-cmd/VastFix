# API ảnh CP2 - bàn giao Hải Anh / Chúc / Dương / Sơn

Áp dụng trên nhánh `feat/cp2-photo-storage`. Schema dùng migration `20261126000000_photo_storage`. API dùng phiên đăng nhập hiện có; actor và owner do backend xác định. Không truyền `ownerUserId`, đường dẫn tệp hoặc quyền từ trình duyệt.

## 1. Tải một ảnh lên

`POST /api/uploads`, body `multipart/form-data`, một file mỗi request:

| Trường | Ảnh báo cáo | Ảnh hoàn thành |
| --- | --- | --- |
| `purpose` | `REPORT` | `WORK_EVIDENCE` |
| `file` | JPEG/PNG/WebP, không quá 5 MB | Như ảnh báo cáo |
| `issueId` | Không gửi | UUID công việc đang `IN_PROGRESS` của STAFF hiện tại |

Trình duyệt tự tạo Content-Type/boundary khi dùng FormData; không tự gán Content-Type. Yêu cầu ghi phải có Origin khớp origin cấu hình `BETTER_AUTH_URL` (trình duyệt cùng nguồn tự gửi).

```js
const form = new FormData();
form.set("purpose", "REPORT");
form.set("file", selectedFile);
const response = await fetch("/api/uploads", { method: "POST", body: form });
const result = await response.json();
```

HTTP 201:

```json
{
  "photo": {
    "photoId": "<uuid>",
    "url": "/api/photos/<uuid>",
    "mimeType": "image/png",
    "sizeBytes": 1024,
    "purpose": "REPORT"
  },
  "requestId": "<uuid>"
}
```

Đây là ảnh nháp đã lưu tệp, chưa phải một Report hoặc một lần nộp hoàn thành. Không tự tạo phiếu khi upload. Backend kiểm MIME, chữ ký và khả năng giải mã; không nhận SVG, ảnh động hoặc ảnh trên 24 triệu pixel. Ảnh được mã hóa lại trước khi có Report để bỏ metadata, rồi giữ nguyên tệp đã lưu. Định dạng đầu ra vẫn JPEG/PNG/WebP tương ứng; dữ liệu sau xử lý cũng không vượt 5 MB. Thư viện xử lý ảnh được ghim trong package/lockfile; tham khảo [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/) và [output options](https://sharp.pixelplumbing.com/api-output/).

## 2. Gắn ảnh báo cáo

Gọi `POST /api/reports` như v1, thêm trường tùy chọn `photoIds` gồm 0-3 UUID nhận từ upload REPORT. Request cũ không có trường này vẫn hợp lệ; response thành công giữ dạng v1.

```json
{
  "description": "Đèn H2-03 không sáng",
  "location": { "kind": "OUTDOOR", "detail": "Khu vực diễn tập" },
  "photoIds": ["<uuid ảnh REPORT của người đang đăng nhập>"]
}
```

Report, Issue, event và việc liên kết ảnh dùng cùng transaction. Sai owner, ảnh chưa lưu/đã dùng/sai purpose hoặc có UUID trùng thì không tạo Report dở dang. Một ảnh nháp chỉ được gắn một lần. Không có API thêm, thay hoặc xóa ảnh của Report đã gửi; gộp/hủy gộp không chuyển Photo sang Report khác.

## 3. Nộp minh chứng qua API của Chúc

STAFF được giao gọi upload với `purpose=WORK_EVIDENCE` và `issueId`. Sau đó gửi `evidencePhotoIds` vào `POST /api/staff/issues/:id/submit` cùng `expectedVersion` mới nhất và `completionNote`.

Upload không đổi trạng thái hoặc tăng version workflow; `/submit` mới gắn ảnh với event `WORK_SUBMITTED` trong transaction và đổi trạng thái. Mỗi lượt có tối đa 3 ảnh. Quản lý trả lại công việc thì ảnh lần trước vẫn gắn event cũ; nhân viên tải ảnh mới cho lượt tiếp theo.

## 4. Đọc và xóa ảnh

`GET`/`HEAD /api/photos/:id` kiểm quyền ở mỗi request. GET trả byte ảnh, không trả JSON khi thành công. Có `private, no-store`, `Vary: Cookie`, `nosniff` và không phục vụ qua `public/`.

| Loại ảnh | Ai được đọc |
| --- | --- |
| REPORT chưa gắn | Người tải ảnh đó |
| REPORT đã gắn | Người báo của Report đó; MANAGER; STAFF đang được giao phiếu hiệu lực |
| WORK_EVIDENCE chưa submit | STAFF tải ảnh, vẫn còn quyền trên công việc |
| WORK_EVIDENCE đã submit | MANAGER; STAFF được giao hiện tại; người báo có Report thuộc phiếu đó, gồm nguồn đang gộp vào |

Người báo theo dõi hoặc sở hữu Report khác không được xem ảnh hiện trạng của người khác. Khi hủy gộp hoặc đổi người được giao, backend tính lại quan hệ hiện hành; quyền không giữ theo lần xem trước. Kiểm quyền qua quan hệ gộp/hủy gộp hiện được chạy qua API thật trong `test:photos`. Hợp đồng gộp và rà lại nguồn ở [Checkpoint2_Backend_Contract.md](Checkpoint2_Backend_Contract.md).

`DELETE /api/photos/:id` chỉ xóa ảnh nháp của chính người tải, chưa có `reportId`/`submissionEventId`. Ảnh đã nộp trả 409. FE gọi DELETE khi bỏ ảnh đã upload khỏi form. Mỗi tài khoản giữ tối đa 12 ảnh nháp; quá giới hạn cần bỏ ảnh không dùng trước khi tải thêm. Nếu người dùng bỏ hẳn trình duyệt, ảnh nháp có thể còn; tự động dọn theo tuổi chưa được triển khai.

## 5. Lỗi và vận hành

Lỗi theo JSON v1 có requestId: 400 dữ liệu/mã ảnh không hợp lệ, 401 thiếu phiên, 403 sai vai/Origin, 404 không có quyền xem hoặc không tồn tại, 409 ảnh đã dùng/xung đột/quá số ảnh, 413 quá dung lượng, 415 sai định dạng, 503 không ghi/đọc được tệp. Khi nhận 409 workflow, tải lại detail để lấy version; không tự gửi lại Report khi chưa biết kết quả lần trước.

Host lưu tại `VASTFIX_UPLOAD_DIR`, mặc định `data/private/photos`. Compose dùng `/app/data/private/photos` và volume `vastfix_photo_data`; thư mục thuộc user node, tệp chỉ owner hệ điều hành đọc/ghi. Không đặt thư mục vào public. Sao lưu phải giữ cả DB và volume ảnh; không xóa volume khi khởi động lại. Image build loại dữ liệu riêng; đường tệp runtime không bị đóng gói vào build.

```bash
npm run build
npm run test:photos
node scripts/check-workflow-api.mjs
```

`test:photos` dùng DB/PostgreSQL tạm và ảnh thật, không sử dụng DB nhóm. Giao diện chọn ảnh/viewer vẫn là phần FE cần nối theo hợp đồng này.
