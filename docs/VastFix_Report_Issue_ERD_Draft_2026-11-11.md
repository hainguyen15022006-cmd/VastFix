# VastFix — bản nháp mô hình Report–Issue cho Checkpoint 1

**Người chuẩn bị:** Hải Anh (nhóm trưởng, backend nền tảng)

**Ngày:** 11/11/2026

**Trạng thái:** Hải Anh đã chọn phương án cho O1–O8 và O10 ngày 11/11/2026; O9 là quy tắc tạm chờ thầy xác nhận. ERD vẫn là bản thiết kế, chưa có phần nào được triển khai.

**Căn cứ:** Đặc tả VastFix đã được supervisor duyệt và kế hoạch Checkpoint 1 của nhóm.

## 1. Mục đích và ba quyết định đề xuất

1. **Report là bản ghi lời báo gốc.** Sau khi gửi, mô tả, vị trí đã chọn, thời điểm và ảnh gốc không bị sửa bởi thao tác gộp/hủy gộp. Nếu cần đính chính, tạo bản ghi bổ sung có lịch sử thay vì ghi đè âm thầm.
2. **Issue là phiếu xử lý.** Mỗi Report mới mở một Issue riêng. Nếu người dùng chọn *theo dõi* Issue đã có trước khi gửi, hệ thống tạo quan hệ theo dõi và **không tạo Report mới**, đúng với đặc tả.
3. **Gộp là quan hệ giữa các Issue.** `IssueMerge` ghi Issue nguồn → Issue đích. Report vẫn gắn với Issue gốc. Hủy gộp chỉ đóng quan hệ gộp đang hoạt động; không sửa hoặc xóa Report. Mọi thao tác có người thực hiện, thời điểm, lý do và nhật ký.

Nhờ đó, một Issue hiển thị nhiều Report sau khi gộp, nhưng từng Report vẫn truy được Issue gốc của nó. Việc “gộp phản ánh vào một phiếu” là **cách hiển thị và xử lý hiệu lực**, không phải chuyển quyền sở hữu hoặc viết lại báo cáo gốc.

## 2. Sơ đồ ERD bản nháp

```mermaid
erDiagram
    USER ||--o{ REPORT : submits
    USER ||--o{ ISSUE_FOLLOW : follows
    USER ||--o{ ISSUE_EVENT : performs
    USER ||--o{ ISSUE : assigned_to
    BUILDING ||--o{ FLOOR : contains
    FLOOR ||--o{ AREA : contains
    AREA ||--o{ REPORT : reported_in
    AREA ||--o{ ISSUE : canonical_area
    CATEGORY ||--o{ REPORT : proposed_category
    CATEGORY ||--o{ ISSUE : confirmed_category
    REPORT ||--|| ISSUE : opens
    ISSUE ||--o{ ISSUE_FOLLOW : has
    ISSUE ||--o{ ISSUE_EVENT : records
    ISSUE ||--o{ ISSUE_MERGE : source_or_target
    REPORT ||--o{ REPORT_PHOTO : attaches
    ISSUE ||--o{ WORK_EVIDENCE : has

    USER {
        uuid id PK
        string email UK
        enum role
        string locale
    }
    BUILDING {
        uuid id PK
        string code UK
        string name_vi
        string name_en
    }
    FLOOR {
        uuid id PK
        uuid building_id FK
        string code
        string name_vi
        string name_en
    }
    AREA {
        uuid id PK
        uuid floor_id FK
        string code
        string name_vi
        string name_en
    }
    CATEGORY {
        uuid id PK
        string code UK
        string name_vi
        string name_en
    }
    REPORT {
        uuid id PK
        uuid reporter_id FK
        string description
        string description_lang
        uuid proposed_category_id FK
        enum location_kind
        uuid area_id FK
        string location_detail
        json location_snapshot
        datetime submitted_at
    }
    ISSUE {
        uuid id PK
        uuid origin_report_id FK_UK
        uuid confirmed_category_id FK
        enum status
        enum priority
        uuid assignee_id FK
        datetime due_at
        boolean review_required
        uuid recurrence_of_issue_id FK
        datetime created_at
    }
    ISSUE_MERGE {
        uuid id PK
        uuid source_issue_id FK
        uuid target_issue_id FK
        uuid merged_by_user_id FK
        datetime merged_at
        uuid reversed_by_user_id FK
        datetime reversed_at
        string reason
    }
    ISSUE_EVENT {
        uuid id PK
        uuid issue_id FK
        uuid actor_user_id FK
        string event_type
        json details
        datetime occurred_at
    }
    ISSUE_FOLLOW {
        uuid user_id PK_FK
        uuid issue_id PK_FK
        datetime created_at
    }
    REPORT_PHOTO {
        uuid id PK
        uuid report_id FK
        string object_key
    }
    WORK_EVIDENCE {
        uuid id PK
        uuid issue_id FK
        uuid uploaded_by_user_id FK
        string object_key
    }
```

**Chú thích:** Mermaid gom hai vai trò của `ISSUE_MERGE` vào một nét để sơ đồ dễ đọc; trong CSDL thật, `source_issue_id` và `target_issue_id` là hai khóa ngoại riêng. `REPORT` lưu `area_id` cho trường hợp trong nhà; với ngoài trời, dùng `location_kind=OUTDOOR`, mô tả khu vực và ghim tùy chọn. Hình thức lưu tọa độ/địa điểm ngoài trời cần chốt ở câu hỏi O4. `REPORT.location_snapshot` giữ bản chụp tên tòa/tầng/khu vực tại lúc gửi, tránh lịch sử đổi nghĩa nếu danh mục được đổi tên sau này.

## 3. Danh sách thực thể và trách nhiệm

| Nhóm | Thực thể | Trách nhiệm chính | Giai đoạn |
| --- | --- | --- | --- |
| Danh mục | `Building`, `Floor`, `Area` | Cấu trúc vị trí trong nhà, tên Việt/Anh; quản lý khai báo. | Thiết kế M1, seed checkpoint |
| Danh mục | `Category` | 4–6 loại sự cố, tên Việt/Anh. | Thiết kế M1, seed checkpoint |
| Tài khoản | `User` | Email, vai trò, ngôn ngữ; quản lý/nhân viên được tạo theo quy tắc phân quyền. | Thiết kế M1; xác thực hoàn chỉnh sau |
| Báo gốc | `Report` | Lời báo, loại dự kiến, vị trí và bản chụp vị trí lúc gửi; không bị thay bởi merge. | Cốt lõi checkpoint |
| Xử lý | `Issue` | Trạng thái, loại đã xác nhận, ưu tiên, người xử lý, hạn, liên kết tái phát. | Cốt lõi mô hình; luồng đầy đủ sau |
| Gộp | `IssueMerge` | Quan hệ nguồn–đích có thể đảo ngược, người làm, thời điểm, lý do. | Thiết kế M1; thao tác sau |
| Nhật ký | `IssueEvent` | Sự kiện bất biến: tạo, phân công, đổi trạng thái, gộp, hủy gộp, đóng. | Thiết kế M1; ghi sự kiện dần |
| Theo dõi | `IssueFollow` | Người quan tâm một Issue; unique `(user_id, issue_id)`. | Thiết kế M1; chức năng sau |
| Ảnh | `ReportPhoto` | Ảnh hiện trạng, gắn đúng Report gốc. | Sau checkpoint |
| Bằng chứng | `WorkEvidence` | Ảnh sau sửa và ghi chú của nhân viên, gắn Issue. | Sau checkpoint |
| Hoàn thiện | `Notification`, `OutcomeFeedback`, `SlaPolicy` | Thông báo, xác nhận/chưa đạt, hạn theo P0–P2. | Thiết kế tiếp, vẫn thuộc đặc tả cuối kỳ |

**Lưu ý mô hình:** `Issue.origin_report_id` là duy nhất, nên một Report tạo một Issue ban đầu. Các Report khác được nhìn thấy trong cùng phiếu hiệu lực qua chuỗi `IssueMerge`, không cần cập nhật khóa ngoại của Report. Để hiển thị, truy vấn từ Issue đích tới mọi Issue nguồn đang gộp vào nó rồi lấy Report gốc của các Issue đó.

## 4. Quy tắc dữ liệu bắt buộc

- Một `Report` đã gửi có đúng một Issue gốc; thông tin báo gốc là append-only đối với thao tác gộp. Không dùng `DELETE` để gộp.
- `IssueMerge.source_issue_id != target_issue_id`. Một Issue nguồn chỉ có tối đa **một** quan hệ gộp đang hoạt động (`reversed_at IS NULL`). Chỉ gộp Issue nguồn chưa có Issue khác đang gộp vào nó vào Issue đích chưa gộp đi đâu: cấu trúc một tầng, nhiều nguồn → một đích. Không tạo chuỗi I2→I1→I4.
- Chỉ gộp các Issue còn mở và đang là phiếu hiệu lực; trường hợp đóng rồi tái phát tạo Issue mới có liên kết tới Issue cũ.
- Chỉ quản lý được tạo hoặc hủy `IssueMerge`. Thao tác phải chạy trong một giao dịch cùng bản ghi `IssueEvent`; nếu một bước lỗi, cả thao tác không được ghi nửa chừng.
- Issue nguồn khi đang gộp vẫn còn trong CSDL. Màn hình làm việc và thông báo đi theo Issue đích; trạng thái và phân công của nguồn tạm ngừng, không bị ghi đè. Khi hủy gộp, nguồn hiện lại với `review_required=true`; quản lý phải rà trạng thái, người xử lý và hạn trước khi giao tiếp.
- AI chỉ đề xuất Issue đang mở. Issue đã đóng rồi hỏng lại tạo Issue mới có `recurrence_of_issue_id` trỏ về Issue cũ.
- Người báo chỉ xem ảnh của Report do mình tạo; nhân viên được giao và quản lý xem ảnh cần cho công việc. Việc gộp không tự cấp quyền xem ảnh của người báo khác.
- `IssueEvent` và `IssueMerge` giữ lịch sử; hủy gộp đặt `reversed_at`/`reversed_by_user_id` và ghi sự kiện `UNMERGED`, không xóa dòng gộp cũ.

## 5. Ví dụ kiểm tra gộp / hủy gộp

**Trước gộp:** `R1 → I1` (đèn H2-03 không sáng) và `R2 → I2` (cùng đèn H2-03, mô tả khác). `R3 → I3` là đèn H2-04, cùng hành lang nhưng khác bóng. R1/R2 là trùng; R3 không trùng.

**Quản lý gộp I2 vào I1:** tạo `IssueMerge(M1, source=I2, target=I1, reversed_at=NULL)`. Màn I1 hiển thị R1 và R2; I2 không còn là phiếu làm việc độc lập. Trong CSDL vẫn là `I1.origin_report_id=R1` và `I2.origin_report_id=R2`. R1/R2 không bị sửa. I3 vẫn độc lập.

**Quản lý hủy gộp:** cập nhật M1 bằng `reversed_at`, `reversed_by_user_id`, lý do; thêm `IssueEvent(UNMERGED)`. I2 lại xuất hiện với R2 và dữ liệu xử lý đã có trước khi gộp, có cờ cần quản lý rà lại. R1, R2, I1 và I2 vẫn giữ ID cũ. Lịch sử M1 vẫn tra cứu được.

**Nhiều báo cáo cùng một phiếu:** cho phép I2→I1 và I3→I1, nên I1 hiển thị R1, R2 và R3. Hủy I2→I1 chỉ tách I2/R2; I3/R3 vẫn thuộc I1. Không cho I1→I4 khi I1 đang có I2/I3 gộp vào. Muốn đổi phiếu đích của cả cụm, quản lý hủy các quan hệ cũ rồi gộp lại từng Issue vào I4, với nhật ký đầy đủ. Đây là giới hạn chủ ý để thao tác hủy gộp dễ hiểu và kiểm thử.

## 6. Quyết định Hải Anh chọn cho bản v1

Hải Anh đã chọn các phương án sau ngày 11/11/2026. Đây là chỉ đạo thiết kế của nhóm trưởng để các mảng làm thống nhất, **không phải bằng chứng rằng cả nhóm đã họp hoặc đã triển khai**. O9 vẫn cần thầy xác nhận trước khi coi là quy tắc vận hành chính thức.

| Mã | Quyết định cho bản v1 | Trạng thái / người cần được thông báo |
| --- | --- | --- |
| O1 | Report gốc không bị ghi đè sau khi gửi; đính chính là bản ghi bổ sung có thời gian và người thực hiện. | Hải Anh đã chọn; Dương, Chúc cần biết. |
| O2 | Bấm “theo dõi” tạo `IssueFollow`, không tạo Report/Issue mới; cho bỏ theo dõi. | Hải Anh đã chọn; Dương, Chúc cần biết. |
| O3 | Môi trường demo seed quản lý đầu tiên qua thiết lập có kiểm soát; sau đó quản lý cấp vai và ghi nhật ký. Không có đăng ký công khai cho nhân viên/quản lý. | Hải Anh đã chọn; Chúc, Hoàng Anh cần biết. |
| O4 | Trong nhà chọn tòa → tầng → khu vực, thêm `location_detail` khi cần. Ngoài trời có mô tả khu vực và ghim tùy chọn. Không bắt buộc mã thiết bị nhưng nhắc người báo khi vị trí quá rộng. | Hải Anh đã chọn; Dương, Sơn, Chúc cần biết. |
| O5 | Gộp **một tầng**: nhiều Issue nguồn độc lập vào một Issue đích. Không cho gộp tiếp một Issue đích đang có nguồn vào Issue khác; muốn đổi đích thì hủy rồi gộp lại có nhật ký. | Hải Anh đã chọn; Chúc, Sơn cần biết. |
| O6 | Khi hủy gộp, Issue nguồn giữ dữ liệu trước gộp và được đánh dấu `review_required=true`; quản lý rà lại trạng thái, người xử lý và hạn trước khi tiếp tục. | Hải Anh đã chọn; Chúc, Sơn cần biết. |
| O7 | AI xét Issue còn mở ở vùng vị trí liên quan, không giới hạn cứng đúng một khu vực; Issue đã đóng chỉ có thể hiện riêng như lịch sử tái phát. | Hải Anh đã chọn; Chúc, Thành Lê, Công Thành cần biết. |
| O8 | Ảnh Report chỉ cho chủ ảnh, nhân viên được giao Issue đích và quản lý; người theo dõi khác không tự xem được. Backend kiểm tra quyền khi lấy ảnh. | Hải Anh đã chọn; Chúc, Sơn cần biết. |
| O9 | Tạm dùng múi giờ `Asia/Ho_Chi_Minh`; P0 tính giờ liên tục, P1/P2 tính theo lịch làm việc cấu hình. Giờ hành chính/ngày nghỉ cần xin thầy xác nhận. | **Tạm thời**, chưa chốt lịch vận hành; Hải Anh + Chúc hỏi thầy. |
| O10 | “Vòi rò” và “sàn ướt dưới vòi” là trùng nếu có đủ căn cứ cùng nguyên nhân và một lần sửa giải quyết cả hai; nếu thiếu thông tin thì “không chắc”. | Hải Anh đã chọn; Công Thành đưa vào hướng dẫn gán nhãn. |

## 7. Họp chốt M1 và đầu ra checkpoint

**Chưa có biên bản họp thực tế.** Đây là agenda đề xuất cho buổi họp gần nhất hoặc để chốt bất đồng qua chat khi nhóm không thể họp thêm trước ngày review.

| Phút | Nội dung | Người dẫn | Đầu ra |
| --- | --- | --- | --- |
| 0–5 | Nhắc mục tiêu: hoàn thành M1 và lát cắt demo 13/11; xác nhận hiện trạng thực tế. | Hải Anh | Không nhầm kế hoạch với tiến độ. |
| 5–15 | Đi qua R1/I1, merge, undo, ca H2-03/H2-04; xác nhận định nghĩa trùng. | Hải Anh + Công Thành | Quy tắc nhãn và ví dụ khó. |
| 15–25 | Xem ERD, quyền ảnh, vị trí; Chúc chỉ ra rủi ro triển khai. | Hải Anh + Chúc | ERD v1 và các chỉnh sửa bắt buộc. |
| 25–35 | Thông báo quyết định O1–O8/O10 của Hải Anh, lấy phản hồi về tác động kỹ thuật; ghi O9 để hỏi thầy. | Cả nhóm | Decision log cập nhật, không giả định đã họp. |
| 35–45 | Xác nhận giao diện demo, API v1 và người demo từng đoạn. | Dương + Sơn + Thành Lê + Hoàng Anh | Kịch bản và gói review thống nhất. |

**Đầu ra checkpoint cần Hải Anh gửi cho nhóm/supervisor:** (1) ERD v1 và danh sách thực thể; (2) bảng quyết định O1–O10 có trạng thái; (3) định nghĩa trùng và bộ ví dụ; (4) ma trận quyền và trạng thái Issue; (5) hợp đồng API web–AI; (6) video hoặc bản chạy của lát cắt demo nếu kịp. Những mục chưa hoàn thành phải ghi “chưa làm”, không dùng bản nháp để thay bằng chứng chạy thật.

**Mẫu tin nhắn gửi nhóm:** `Mình đã chọn phương án O1–O8/O10 trong tài liệu để thống nhất thiết kế. Đặc biệt O5 gộp một tầng và O6 rà lại Issue sau hủy gộp. Nhờ từng owner đọc phần liên quan và báo ngay nếu có rủi ro hoặc cần đổi API/UI; O9 mình sẽ hỏi thầy. Hiện nhóm chưa triển khai các chức năng này.`
