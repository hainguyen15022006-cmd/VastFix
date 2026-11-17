# VastFix — Hợp đồng v1: quyền, trạng thái Issue và API

**Trạng thái:** V1 đã được nhóm chốt theo xác nhận của Hải Anh (nhóm trưởng) ngày 16/11/2026. Đây là quyết định thiết kế, chưa phải xác nhận API đã được lập trình hoặc kiểm thử. Chưa có biên bản chữ ký riêng của từng thành viên đính kèm.

**Ngày soạn bản đề xuất:** 11/11/2026. **Ngày ghi nhận chốt v1:** 16/11/2026.

**Phạm vi:** Hợp đồng giao tiếp và quy tắc phân quyền cho Checkpoint 1; schema `/classify` là phần chuẩn bị cho checkpoint sau. Đặc tả cuối kỳ đã được supervisor chốt vẫn giữ nguyên.

**Tài liệu liên quan:** `VastFix_Report_Issue_ERD_Draft_2026-11-11.md`.

**Người dùng tài liệu:** Hải Anh và Chúc triển khai backend; Thành Lê triển khai dịch vụ AI; Dương/Sơn nối giao diện; Công Thành thiết kế dữ liệu kiểm thử/đánh giá; Hoàng Anh kiểm thử tích hợp. Các bên dùng đúng tên trường và trạng thái trong tài liệu này. Nếu cần sửa hợp đồng, ghi thay đổi và thông báo trước khi các phần phụ thuộc cập nhật.

## 1. Những điểm phải thống nhất trước khi code

1. **Hai lớp API:** trình duyệt chỉ gọi API của Next.js; Next.js gọi FastAPI nội bộ để xếp hạng. FastAPI không đọc PostgreSQL và không nhận ảnh.
2. **Report là bản báo gốc, Issue là phiếu xử lý.** Gửi Report mới tạo Issue mới ở trạng thái `SUBMITTED`; theo dõi Issue có sẵn không tạo Report.
3. **AI trả ứng viên, không trả quyết định.** AI không tạo/gộp/xóa Issue, không đặt ưu tiên, phân công hoặc đóng việc. `score` là điểm xếp hạng 0–1, **không được gọi là xác suất trùng** nếu chưa hiệu chuẩn.
4. **Mã lý do thay vì câu văn từ AI:** FastAPI trả `reason_codes` ổn định; Next.js dịch mã thành câu Việt/Anh. Ví dụ `SAME_AREA`, `SIMILAR_DESCRIPTION`, `RECENT_REPORT`.
5. **Gộp một tầng** theo quyết định Hải Anh O5: nhiều Issue nguồn vào một Issue đích; không tạo chuỗi gộp. Hủy gộp giữ dữ liệu nguồn và đặt `review_required=true`.
6. **Không để AI chặn việc báo sự cố.** Nếu FastAPI lỗi hoặc quá thời gian, web báo rõ “gợi ý tạm không khả dụng” và vẫn cho gửi Report. Lỗi AI phải được ghi log.

### Quy ước chung

| Mục | Quy ước v1 |
| --- | --- |
| ID | UUID dạng chuỗi cho User, Report, Issue, Building, Floor, Area. ID trong ví dụ là giả. |
| Thời gian API | ISO 8601 có timezone, lưu UTC; giao diện hiển thị theo locale và `Asia/Ho_Chi_Minh`. |
| Ngôn ngữ trường | API Next.js dùng `camelCase`; API FastAPI nội bộ dùng `snake_case`. |
| Mô tả người dùng | Giữ nguyên ngôn ngữ và chữ người dùng nhập; không dịch tự động. |
| HTTP lỗi | JSON `{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`. Không lộ stack trace hoặc dữ liệu nhạy cảm. |
| Xác thực | API web dùng phiên đăng nhập. Người báo đăng ký bằng email `@usth.edu.vn`; nhân viên/quản lý do quản lý cấp vai, tài khoản quản lý đầu tiên được khởi tạo có kiểm soát. |
| Ảnh | Không đưa ảnh vào `/duplicates`; ảnh gốc gắn Report, bằng chứng sau sửa gắn Issue. Upload thật nằm ở checkpoint sau. |

## 2. Bảng quyền ba vai

**Quy ước:** `✓` được phép; `—` không được; `theo quan hệ` nghĩa là backend kiểm tra người đó có tạo Report, theo dõi Issue, hoặc được giao Issue cụ thể hay không. V1 chốt quyền **báo sự cố/theo dõi là quyền nền của mọi tài khoản đã đăng nhập**; quyền nhân viên/quản lý bổ sung lên trên.

| Hành động | Người báo | Nhân viên | Quản lý | Điều kiện bắt buộc |
| --- | :---: | :---: | :---: | --- |
| Tạo Report, xem Report mình tạo | ✓ | ✓ | ✓ | Đã đăng nhập; vị trí và mô tả hợp lệ. |
| Xem tóm tắt Issue đang mở gần vị trí, theo dõi/bỏ theo dõi | ✓ | ✓ | ✓ | Không lộ ảnh và danh tính người báo khác. |
| Xem ảnh Report mình gửi | ✓ | ✓ | ✓ | Chỉ ảnh của chính Report đó. |
| Xem danh sách toàn khuôn viên và mọi Issue | — | — | ✓ | Quản lý. |
| Xem Issue được giao và ảnh cần để sửa | — | ✓ | ✓ | Nhân viên chỉ xem Issue mình đang được giao; quản lý xem tất cả. |
| Đổi tiến độ, ghi vật tư, nộp bằng chứng | — | ✓ | — | Nhân viên được giao; Issue chưa đóng và không bị gộp làm nguồn. |
| Xác nhận loại, đặt ưu tiên/hạn, phân công | — | — | ✓ | Ghi `IssueEvent` với người làm và thời điểm. |
| Gộp/hủy gộp Issue | — | — | ✓ | Tuân O5/O6; lý do và nhật ký bắt buộc. |
| Đóng hoặc mở lại Issue | — | — | ✓ | Đóng sau khi xem bằng chứng; mở lại cần lý do. |
| Xác nhận kết quả hoặc báo “chưa đạt” | Theo quan hệ | Theo quan hệ | Theo quan hệ | Người tạo Report thuộc Issue hoặc người theo dõi Issue; không tự đổi trạng thái. |
| Cấp vai nhân viên/quản lý | — | — | ✓ | Tài khoản quản lý đầu tiên do quy trình khởi tạo riêng. |

**Bảo vệ dữ liệu:** backend phải kiểm tra quyền ở mọi endpoint và khi lấy object ảnh. Ẩn nút trên frontend không thay cho phân quyền. Việc gộp không tự cấp cho người theo dõi quyền xem ảnh của những người báo khác.

## 3. Trạng thái phiếu Issue

`Issue.status` có sáu giá trị v1:

```text
SUBMITTED → TRIAGED → ASSIGNED → IN_PROGRESS → AWAITING_REVIEW → CLOSED
                  ↑            ↑                  │
                  └── manager có thể điều chỉnh ──┘
```

| Từ → đến | Ai thực hiện | Điều kiện / dữ liệu bắt buộc | Sự kiện lưu |
| --- | --- | --- | --- |
| Tạo mới → `SUBMITTED` | Người gửi qua API | Lưu Report và Issue trong cùng giao dịch. | `REPORT_SUBMITTED` |
| `SUBMITTED` → `TRIAGED` | Quản lý | Xác nhận category, priority; tính hạn theo chính sách hiện hành. | `ISSUE_TRIAGED` |
| `TRIAGED` → `ASSIGNED` | Quản lý | Chọn nhân viên hợp lệ. | `ISSUE_ASSIGNED` |
| `ASSIGNED` → `IN_PROGRESS` | Nhân viên được giao | Bắt đầu xử lý. | `WORK_STARTED` |
| `IN_PROGRESS` → `AWAITING_REVIEW` | Nhân viên được giao | Ghi chú hoàn thành và bằng chứng theo quy định của nhóm. | `WORK_SUBMITTED` |
| `AWAITING_REVIEW` → `CLOSED` | Quản lý | Kiểm tra bằng chứng, ghi thời điểm đóng. | `ISSUE_CLOSED` |
| `AWAITING_REVIEW` → `IN_PROGRESS` | Quản lý | Chưa đạt; có lý do gửi nhân viên. | `WORK_RETURNED` |
| `ASSIGNED`/`IN_PROGRESS` → `TRIAGED` | Quản lý | Cần phân công lại hoặc sửa đánh giá; lý do bắt buộc. | `ISSUE_RETURNED_TO_TRIAGE` |
| `CLOSED` → `TRIAGED` | Quản lý | Chỉ khi quyết định mở lại cùng lần xử lý; lý do bắt buộc. Sự cố tái phát sau một thời gian tạo Issue mới liên kết Issue cũ. | `ISSUE_REOPENED` |

**“Chưa đạt” của người báo:** lưu `OutcomeFeedback(UNSATISFACTORY)` và báo quản lý. Không để người báo tự chuyển `CLOSED → IN_PROGRESS`; quản lý xem phản hồi rồi quyết định mở lại hoặc tạo xử lý mới.

**Gộp là trạng thái độc lập:** `IssueMerge` hoạt động không biến `Issue.status` thành `MERGED`. Issue nguồn tạm ẩn/khóa cập nhật công việc. Khi hủy gộp, nó trở lại với trạng thái cũ, `review_required=true`; quản lý rà rồi mới cho xử lý tiếp. Mọi đổi trạng thái có `IssueEvent`.

## 4. Hợp đồng API cho lát cắt Checkpoint 1

### 4.1. Trình duyệt → Next.js: `POST /api/duplicate-suggestions`

**Mục đích:** gợi ý trước khi gửi. Gọi sau khi có mô tả và vị trí; có thể gọi lại khi người dùng sửa. Backend lọc ứng viên Issue còn mở ở vùng liên quan, gửi bản mô tả gốc tới FastAPI, rồi bổ sung tóm tắt cho frontend. Không tự tạo Report hoặc gộp Issue.

**Request (JSON):**

```json
{
  "description": "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
  "proposedCategoryCode": "ELECTRICAL",
  "location": {
    "kind": "INDOOR",
    "buildingId": "11111111-1111-4111-8111-111111111111",
    "floorId": "22222222-2222-4222-8222-222222222222",
    "areaId": "33333333-3333-4333-8333-333333333333",
    "detail": "đèn H2-03"
  }
}
```

Với vị trí trong nhà, backend kiểm tra `floorId` thuộc `buildingId` và `areaId` thuộc `floorId`. Với ngoài trời, `location` có dạng `{ "kind": "OUTDOOR", "detail": "gần cổng 18-2", "latitude": null, "longitude": null }`; tọa độ là tùy chọn, còn mô tả vị trí là bắt buộc. Mã tòa trong ảnh khuôn viên chỉ là tham chiếu cho danh mục `Building`, không suy ra số tầng/khu vực từ ảnh.

**200 Response (JSON):**

```json
{
  "requestId": "44444444-4444-4444-8444-444444444444",
  "aiStatus": "ok",
  "suggestions": [
    {
      "reportId": "55555555-5555-4555-8555-555555555555",
      "issueId": "66666666-6666-4666-8666-666666666666",
      "score": 0.87,
      "reasonCodes": ["SAME_AREA", "SIMILAR_DESCRIPTION", "RECENT_REPORT"],
      "summary": "Bóng đèn H2-03 ở hành lang giữa tầng 2 bị tắt",
      "locationLabel": "A1 · tầng 2 · hành lang giữa",
      "createdAt": "2026-11-11T08:30:00Z"
    }
  ]
}
```

`suggestions` có **0–5 phần tử**, `score` giảm dần, không lặp `reportId`. `score` là điểm xếp hạng, không phải xác nhận trùng. `reasonCodes` là mã thuộc bộ `SAME_BUILDING`, `SAME_FLOOR`, `SAME_AREA`, `SIMILAR_DESCRIPTION`, `SAME_CATEGORY`, `RECENT_REPORT`; chỉ xuất mã có dữ liệu hỗ trợ. Next.js dịch mã sang `vi`/`en`.

Nếu AI lỗi: trả `200` với `aiStatus: "unavailable"`, `suggestions: []` và `requestId`; giao diện báo gợi ý tạm không khả dụng nhưng vẫn cho gửi. `aiStatus: "ok"` với mảng rỗng nghĩa là AI chạy bình thường nhưng không có gợi ý đủ phù hợp.

**Ví dụ response khi AI không khả dụng:**

```json
{
  "requestId": "44444444-4444-4444-8444-444444444444",
  "aiStatus": "unavailable",
  "suggestions": []
}
```

### 4.2. Trình duyệt → Next.js: `POST /api/reports`

**Request:** cùng `description`, `proposedCategoryCode`, `location` như trên. Trường ảnh chưa nằm trong request Checkpoint 1; khi làm upload sẽ dùng `ReportPhoto` và hợp đồng riêng. Backend kiểm tra vị trí hợp lệ, giữ nguyên mô tả, tạo `Report` và `Issue` trong **một giao dịch**.

**201 Response:**

```json
{
  "report": { "id": "77777777-7777-4777-8777-777777777777", "submittedAt": "2026-11-11T09:00:00Z" },
  "issue": { "id": "88888888-8888-4888-8888-888888888888", "status": "SUBMITTED" },
  "requestId": "99999999-9999-4999-8999-999999999999"
}
```

Việc xem gợi ý không bắt buộc trước khi gửi. Backend không tự gộp Report mới vào Issue được gợi ý.

### 4.3. Trình duyệt → Next.js: `GET /api/manager/issues?status=SUBMITTED`

**200 Response:**

```json
{
  "items": [
    {
      "issueId": "88888888-8888-4888-8888-888888888888",
      "originReportId": "77777777-7777-4777-8777-777777777777",
      "summary": "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
      "locationLabel": "A1 · tầng 2 · hành lang giữa",
      "status": "SUBMITTED",
      "createdAt": "2026-11-11T09:00:00Z"
    }
  ],
  "nextCursor": null,
  "requestId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
}
```

Quyền xem toàn bộ hàng đợi thuộc quản lý. `items` có thể rỗng; `nextCursor` là chuỗi opaque khi còn trang tiếp hoặc `null` khi hết. Nếu checkpoint dùng tài khoản demo, phải ghi rõ cơ chế đăng nhập demo; không gọi endpoint chưa bảo vệ là đã có phân quyền.

### 4.4. Next.js → FastAPI: `POST /duplicates` (nội bộ)

**Request (snake_case):**

```json
{
  "request_id": "44444444-4444-4444-8444-444444444444",
  "query_time": "2026-11-11T09:00:00Z",
  "query": {
    "description": "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
    "proposed_category_code": "ELECTRICAL",
    "location": {
      "kind": "INDOOR",
      "building_id": "11111111-1111-4111-8111-111111111111",
      "floor_id": "22222222-2222-4222-8222-222222222222",
      "area_id": "33333333-3333-4333-8333-333333333333",
      "detail": "đèn H2-03"
    }
  },
  "candidates": [
    {
      "report_id": "55555555-5555-4555-8555-555555555555",
      "issue_id": "66666666-6666-4666-8666-666666666666",
      "description": "Bóng đèn H2-03 ở hành lang giữa tầng 2 bị tắt",
      "category_code": "ELECTRICAL",
      "location": {
        "kind": "INDOOR",
        "building_id": "11111111-1111-4111-8111-111111111111",
        "floor_id": "22222222-2222-4222-8222-222222222222",
        "area_id": "33333333-3333-4333-8333-333333333333",
        "detail": "đèn H2-03"
      },
      "created_at": "2026-11-11T08:30:00Z"
    }
  ],
  "limit": 5
}
```

**200 Response:**

```json
{
  "request_id": "44444444-4444-4444-8444-444444444444",
  "suggestions": [
    {
      "report_id": "55555555-5555-4555-8555-555555555555",
      "score": 0.87,
      "reason_codes": ["SAME_AREA", "SIMILAR_DESCRIPTION", "RECENT_REPORT"]
    }
  ],
  "model_version": "baseline-v1"
}
```

**Ràng buộc cho Thành Lê:** dùng `query_time` để tính tín hiệu thời gian, giúp chạy lại cùng dữ liệu ra cùng kết quả; chỉ trả `report_id` đã có trong `candidates`; ID duy nhất; score hữu hạn trong `[0,1]`, sắp giảm dần; tối đa `min(limit,5)` mục. Mảng ứng viên rỗng → mảng gợi ý rỗng. FastAPI không tự lấy thêm báo cáo, không quyết định gộp. `model_version` ghi rõ baseline hay embedding để kết quả thử có thể kiểm tra.

**Ràng buộc cho Chúc:** chỉ gửi ứng viên Issue còn mở, không bị gộp làm nguồn, trong vùng vị trí liên quan; phải lấy `Report` gốc và thời điểm của ứng viên. Không gửi email, tên người báo, ảnh hay dữ liệu ngoài mục đích xếp hạng. Kiểm tra mọi `report_id` AI trả về thuộc tập ứng viên trước khi bổ sung dữ liệu và trả cho frontend. Với Issue đã nhận nhiều Report qua merge, v1 dùng Report gốc của Issue đích làm đại diện; cách tận dụng các mô tả nguồn sẽ được quyết định sau khi có dữ liệu đánh giá.

**Timeout:** dùng giá trị khởi đầu 5 giây cho pilot và để cấu hình được. Chúc và Thành Lê đo thực tế khi nối hai dịch vụ; nếu cần đổi giá trị cấu hình, ghi lại số đo và quyết định. Thay đổi này không làm đổi hình dạng request/response v1.

### 4.5. FastAPI: `GET /health` và `POST /classify`

`GET /health` trả `200` và JSON như sau; không chứa dữ liệu người dùng:

```json
{ "status": "ok", "model_version": "baseline-v1" }
```

`POST /classify` **chỉ khóa schema trong v1, không thuộc phần phải chạy ở Checkpoint 1**. Ví dụ request:

```json
{
  "description": "Đèn hành lang không sáng",
  "allowed_categories": [
    { "code": "ELECTRICAL", "name_vi": "Điện", "name_en": "Electrical" }
  ]
}
```

Ví dụ response khi có gợi ý:

```json
{ "category_code": "ELECTRICAL", "confidence": 0.82, "model_version": "baseline-v1" }
```

Nếu không đủ tin cậy, `category_code` và `confidence` đều là `null`; quản lý chọn tay. `confidence` là điểm của mô hình trong `[0,1]`, chưa tự coi là xác suất đã hiệu chuẩn. Mã trả về phải thuộc `allowed_categories` của request.

## 5. Ghi nhận quyết định v1 và bàn giao

Hải Anh thông báo ngày 16/11/2026 rằng nhóm đã đồng ý bản đề xuất v1. Vì chưa có biên bản chữ ký riêng đính kèm, tài liệu chỉ ghi nhận **xác nhận của nhóm trưởng về sự đồng thuận của nhóm**, không giả định các cá nhân đã ký văn bản này.

| Người phụ trách | Phần thực hiện từ hợp đồng đã chốt | Bằng chứng khi review |
| --- | --- | --- |
| **Hải Anh** | Schema Report–Issue, quyền truy cập, trạng thái và giao dịch tạo Report+Issue. | ERD đối chiếu được với API; demo tạo mới thành công. |
| **Chúc** | Lọc candidates, nối FastAPI, kiểm tra AI response, trả dữ liệu cho FE. | Demo gợi ý, fallback khi AI lỗi và log. |
| **Thành Lê** | `/duplicates`, `/health`, score, reason codes, model version. | Test với candidates cố định và kết quả có thể lặp lại. |
| **Dương/Sơn** | Form báo sự cố, gợi ý, hàng đợi theo quyền và các trạng thái lỗi/rỗng. | Giao diện dùng đúng tên trường v1. |
| **Công Thành** | Bộ dữ liệu kiểm thử và tình huống trùng/không trùng. | Các ca đánh giá có nhãn và nguồn rõ. |
| **Hoàng Anh** | Chạy tích hợp, phân quyền, kiểm thử end-to-end. | Biên bản chạy thử và lỗi tái hiện được. |

**Quy tắc đổi hợp đồng:** Sau ngày chốt, đổi tên endpoint, field, kiểu dữ liệu, mã trạng thái hoặc ý nghĩa nghiệp vụ phải ghi lý do, phiên bản mới và báo các phần bị ảnh hưởng trước khi sửa. Việc tinh chỉnh ngưỡng AI hay timeout bằng cấu hình có thể làm trong v1 nếu không đổi payload và được ghi vào nhật ký quyết định.

**Năm tình huống cần thử bằng tay hoặc contract test:** (1) không có ứng viên → `suggestions: []`, `aiStatus: ok`; (2) FastAPI lỗi → `aiStatus: unavailable` nhưng tạo Report vẫn được; (3) AI trả ID không nằm trong candidates → backend loại bỏ và ghi log; (4) người báo không mở được ảnh của Report người khác; (5) gửi Report tạo đúng một Report và một Issue `SUBMITTED` cùng giao dịch.

**Việc triển khai còn phải xác định, không làm thay đổi hợp đồng v1:** (a) danh sách 4–6 mã category chính thức để seed/validate; `ELECTRICAL` trong JSON chỉ là ví dụ; (b) ngưỡng điểm hiển thị và số candidates đưa vào AI dựa trên đánh giá; (c) kết quả đo timeout so với mốc cấu hình khởi đầu 5 giây; (d) lịch làm việc/ngày nghỉ cho P1/P2 với supervisor. Quyền tạo Report của nhân viên/quản lý **đã chốt là có** theo bảng quyền.

## 6. Quy tắc dữ liệu và lỗi dùng chung

### 6.1. Định dạng và xác thực

| Mục | Quy tắc v1 |
| --- | --- |
| Content type | Request và response JSON dùng `application/json; charset=utf-8`. |
| Thời gian | `createdAt`, `submittedAt`, `query_time`, `created_at` là chuỗi ngày giờ ISO 8601 có múi giờ, ví dụ `2026-11-16T05:00:00Z`. Hệ thống lưu UTC; UI có thể hiện giờ Việt Nam. |
| ID | UUID ở dạng chuỗi. Các UUID trong ví dụ chỉ để minh họa, không phải dữ liệu thật. |
| Vị trí trong nhà | `buildingId`, `floorId`, `areaId` bắt buộc và phải có quan hệ cha–con hợp lệ. |
| Vị trí ngoài trời | `detail` bắt buộc; `latitude`/`longitude` tùy chọn và phải đi thành cặp nếu cung cấp. |
| Mô tả | `description` phải là chuỗi có nội dung sau khi bỏ khoảng trắng đầu/cuối để kiểm tra; lưu nội dung gốc, không tự dịch. Giới hạn độ dài sẽ đặt trong schema triển khai và công bố đồng nhất ở FE/BE. |
| Mã danh mục | `proposedCategoryCode` có thể bỏ qua; nếu cung cấp thì phải thuộc danh mục đang dùng. Đây là đề xuất của người báo, quản lý có thể xác nhận lại lúc triage. |
| Quyền | Mỗi endpoint public yêu cầu phiên đăng nhập; backend kiểm tra vai và quan hệ với từng tài nguyên. `/duplicates` chỉ gọi trong mạng nội bộ bởi backend. |

### 6.2. Lỗi public API

Lỗi dùng cùng một dạng; `requestId` giúp đối chiếu log. Ví dụ:

```json
{
  "error": {
    "code": "INVALID_LOCATION",
    "message": "Vị trí không hợp lệ"
  },
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

| HTTP | Khi nào | Gợi ý `error.code` |
| --- | --- | --- |
| `400` | JSON sai cú pháp hoặc tham số truy vấn không hợp lệ. | `BAD_REQUEST` |
| `401` | Chưa đăng nhập hoặc phiên hết hạn. | `UNAUTHENTICATED` |
| `403` | Đã đăng nhập nhưng không đủ vai/quyền với tài nguyên. | `FORBIDDEN` |
| `404` | Tài nguyên không tồn tại hoặc không được phép tiết lộ sự tồn tại. | `NOT_FOUND` |
| `422` | Dữ liệu đúng JSON nhưng không đạt quy tắc nghiệp vụ, như vị trí sai quan hệ hoặc danh mục không hợp lệ. | `INVALID_LOCATION`, `INVALID_CATEGORY`, `VALIDATION_ERROR` |
| `500` | Lỗi máy chủ khi tạo/lấy dữ liệu. | `INTERNAL_ERROR` |

Riêng AI lỗi/timeout trong `POST /api/duplicate-suggestions` **không trả lỗi HTTP cho người dùng nếu vẫn có thể gửi Report**: trả `200` với `aiStatus: "unavailable"`, `suggestions: []`. Backend ghi lỗi nội bộ với `requestId`. `POST /api/reports` không phụ thuộc việc trước đó có gọi gợi ý hay không.

## 7. Ranh giới của hợp đồng v1

Hợp đồng này **đã khóa các endpoint và field được nêu**, bảng quyền, trạng thái, hành vi fallback và nguyên tắc Report–Issue. Nó không chứng minh hệ thống đã chạy. Checkpoint 1 cần demo lát cắt tạo Report, gợi ý trùng và hàng đợi quản lý; ảnh thật, theo dõi Issue, phản hồi kết quả và phần vận hành đầy đủ làm ở các checkpoint tiếp theo theo đặc tả cuối kỳ. `POST /classify` mới khóa schema, chưa bắt buộc chạy trong Checkpoint 1.
