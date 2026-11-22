# Bổ sung danh mục cho form báo sự cố — v1.0

Ngày: 21/11/2026. Phạm vi: nhánh `codex/duong-reporter-frontend`, để nhóm review khi ghép phần Dương.

## Lý do

Form cần UUID hợp lệ và quan hệ tòa → tầng → khu vực từ DB. Hợp đồng v1 chưa định nghĩa API đọc danh mục; không dùng ID tự tạo hoặc biến fixture thành danh mục sản phẩm.

Endpoint bổ sung không đổi endpoint, field, kiểu dữ liệu hay ý nghĩa của các API đã chốt. Không có migration hoặc seed mới. Hải Anh/Chúc phụ trách review phần đọc danh mục; Dương/Sơn dùng dữ liệu này cho frontend. Tài liệu này là thông tin bàn giao, không khẳng định nhóm đã phê duyệt phần bổ sung.

## GET /api/report-options

- Dùng session và `currentUser` hiện có, yêu cầu email đã xác minh; mọi vai hợp lệ đều được đọc.
- Không nhận body. Không có dữ liệu người dùng, Report hoặc ảnh trong response.
- `Cache-Control: no-store`; lỗi dùng envelope và requestId chung.
- Lấy dữ liệu đang có trong Building, Floor, Area, Category. Sắp theo code ở mỗi cấp.
- Tên Việt/Anh trả riêng để đổi ngôn ngữ mà không đoán hoặc dịch mô tả người dùng.

```json
{
  "buildings": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "A1",
      "nameVi": "Tòa A1 (minh họa)",
      "nameEn": "A1 (demo)",
      "floors": [
        {
          "id": "22222222-2222-4222-8222-222222222222",
          "nameVi": "Tầng 2",
          "nameEn": "Floor 2",
          "areas": [
            {
              "id": "33333333-3333-4333-8333-333333333333",
              "nameVi": "Hành lang giữa",
              "nameEn": "Middle corridor"
            }
          ]
        }
      ]
    }
  ],
  "categories": [{ "code": "ELECTRICAL", "nameVi": "Điện", "nameEn": "Electrical" }],
  "requestId": "44444444-4444-4444-8444-444444444444"
}
```

ID và danh mục trên là ví dụ từ seed, không đại diện danh mục toàn khuôn viên. Mảng rỗng là hợp lệ. Khi chưa có building, UI thông báo và vẫn cho báo ngoài trời. Category là tùy chọn; chọn “Chưa xác định” sẽ bỏ `proposedCategoryCode` khỏi request.

Frontend xóa floorId/areaId khi đổi building và xóa areaId khi đổi floor. Backend tiếp tục kiểm tra quan hệ và danh mục ở API gửi báo cáo/gợi ý; tải danh mục không thay cho validation khi gửi.


## Ghi nhận tích hợp 22/11/2026

Theo yêu cầu Hải Anh sửa và tích hợp bản nhóm, endpoint đã được review kỹ thuật cùng auth/validation, không đổi request/response v1 cũ. Kiểm thử thật xác nhận khách nhận 401, tài khoản được phép lấy cây danh mục, và form gửi UUID đúng quan hệ về backend. Seed mới có thêm PLUMBING và vị trí tầng 1 minh họa; response lấy danh mục từ DB, không viết cứng số lượng.

## Locale và cursor cho các API hiện có

- `GET /api/manager/issues?status=SUBMITTED&locale=en&cursor=<nextCursor>`: `locale` và `cursor` đều tùy chọn. Mỗi trang tối đa 25 phiếu; truyền nguyên nextCursor nhận được để tải tiếp. Endpoint hiện chỉ nhận SUBMITTED.
- `POST /api/duplicate-suggestions?locale=en`: body v1 giữ nguyên; locale chỉ chọn tên vị trí hệ thống trong response.
- Locale hợp lệ là vi/en; giá trị khác trả 400 BAD_REQUEST theo envelope chung. Nếu bỏ qua locale, giữ hành vi cũ dựa vào User.locale. Không dịch hoặc sửa description/summary, không lưu đè locale của tài khoản khi người dùng xem một trang.
