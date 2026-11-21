# VastFix - Thiết kế đăng nhập và kiểm tra quyền v1

**Người phụ trách:** Hải Anh - backend nền tảng.

**Ngày soạn:** 17/11/2026.

**Trạng thái:** Hải Anh và Chúc đã thống nhất thiết kế Auth/RBAC v1 theo xác nhận của Hải Anh ngày 17/11/2026. Đây là căn cứ triển khai và kiểm thử cho backend, kế thừa bảng quyền/API contract v1 đã chốt. Việc thống nhất thiết kế chưa phải bằng chứng đã triển khai hoặc kiểm thử chức năng xác thực; các ca kiểm thử bên dưới vẫn là “Chưa chạy”.

**Phạm vi thống nhất:** Quy tắc đăng ký/xác minh email, cấp vai, danh tính lấy từ phiên phía server, quyền trên các API Checkpoint 1, lỗi và các tiêu chí kiểm thử. Thư viện xác thực, giải pháp gửi email, thời hạn và nơi lưu phiên chưa được chọn trong tài liệu này.

**Căn cứ:** [API contract v1 đã chốt](VastFix_API_Contract_v1_Da_chot_2026-11-16.md) và [ERD Report-Issue](VastFix_Report_Issue_ERD_Draft_2026-11-11.md).

## 1. Đăng ký, xác minh và cấp vai

| Nội dung | Quy tắc áp dụng |
| --- | --- |
| Người báo tự đăng ký | Dùng địa chỉ email hợp lệ có phần tên miền đúng `usth.edu.vn`. Ví dụ `user@usth.edu.vn.example.com` không hợp lệ. Kiểm tra ở backend. |
| Chứng minh sở hữu email | Hoàn thành xác minh email qua liên kết hoặc mã dùng một lần trước khi dùng các API nghiệp vụ. Có email đúng đuôi chưa đủ chứng minh người đăng ký sở hữu email. |
| Vai khi tự đăng ký | Backend gán `REPORTER`; không nhận vai `STAFF`/`MANAGER` do người đăng ký lựa chọn hoặc gửi lên. |
| Nhân viên/quản lý | Được quản lý tạo hoặc cấp vai có kiểm soát theo contract; không có đăng ký công khai vào hai vai này. |
| Quản lý đầu tiên | Khởi tạo bởi người vận hành trong môi trường kiểm soát; không cung cấp endpoint công khai để tự trở thành quản lý đầu tiên. |
| Thay đổi vai | Kiểm tra quyền quản lý; ghi người thực hiện, người được đổi vai, vai cũ/mới và thời gian. Lần gọi API tiếp theo phải dùng quyền mới. |

Xác minh email, lựa chọn thư viện đăng nhập và cách gửi email chưa có trong code hiện tại. Mốc v1 này thống nhất yêu cầu, chưa tự chọn nhà cung cấp hoặc thêm endpoint xác thực vào API contract.

## 2. Backend nhận diện và kiểm tra người gọi

Mỗi request tới API nghiệp vụ đi theo thứ tự:

1. Kiểm tra phiên đăng nhập bằng cơ chế xác thực phía máy chủ. Thiếu phiên, phiên không hợp lệ hoặc hết hạn: trả `401 UNAUTHENTICATED`.
2. Từ danh tính trong phiên đã xác thực, tìm User hiện hành trong DB và lấy vai hiện hành. User không còn tồn tại: từ chối phiên bằng `401`.
3. Kiểm tra người dùng đã hoàn tất xác minh email theo cơ chế được chọn. Có phiên nhưng chưa xác minh: trả `403 FORBIDDEN` cho API nghiệp vụ; người dùng vẫn có thể thực hiện luồng xác minh.
4. Kiểm tra quyền theo endpoint và theo tài nguyên được yêu cầu. Không có quy tắc cho phép rõ ràng: từ chối. Không đủ vai hoặc quan hệ: trả `403 FORBIDDEN`.
5. Sau khi qua quyền, kiểm tra payload và thực hiện nghiệp vụ. Khi tạo Report, lấy `reporterId` từ User đã xác thực; khi ghi nhật ký, lấy `actorUserId` từ cùng ngữ cảnh đó.

Không lấy danh tính/quyền từ `reporterId`, `userId`, `role` trong body, query hoặc header tùy ý như `X-User-Id`/`X-Role`. Các trường này không thể thay thế phiên đăng nhập. Body gửi Report chỉ nhận các trường nghiệp vụ được phép trong contract; không truyền nguyên body vào lệnh tạo dữ liệu Prisma.

Giao diện có thể ẩn nút để dễ sử dụng, nhưng mọi API vẫn kiểm tra quyền độc lập. Phiên hết hạn hoặc đã đăng xuất phải bị từ chối ở request tiếp theo. Cách lưu phiên, thời hạn và cơ chế chống giả mạo request sẽ được cấu hình khi chọn giải pháp đăng nhập; chưa tạo cơ chế tự lưu vai trong trình duyệt để thay cho xác thực.

## 3. Quyền cho các endpoint của Checkpoint 1

Điều kiện chung: có phiên hợp lệ và đủ điều kiện xác minh email như mục 2. Quyền báo sự cố là quyền nền của cả ba vai theo contract đã chốt.

| Endpoint | REPORTER | STAFF | MANAGER | Điều kiện nghiệp vụ |
| --- | --- | --- | --- | --- |
| `POST /api/reports` | Có | Có | Có | Gán người gửi từ phiên; lưu Report + Issue `SUBMITTED` + IssueEvent trong cùng giao dịch. |
| `POST /api/duplicate-suggestions` | Có | Có | Có | Chỉ trả dữ liệu tóm tắt theo contract; không lộ tên/email người báo hoặc ảnh của người khác. AI lỗi vẫn cho gửi Report. |
| `GET /api/manager/issues?status=SUBMITTED` | Không | Không | Có | Kiểm tra quyền trước khi truy vấn/trả hàng đợi toàn khuôn viên. |

`POST /duplicates` là giao tiếp nội bộ Next.js -> FastAPI; không dùng quyền người báo để cho trình duyệt gọi thẳng. Thành Lê không cần nhận email, phiên đăng nhập hoặc vai người dùng trong request xếp hạng.

Các chức năng sau tiếp tục theo bảng quyền v1: ảnh gốc chỉ cho chủ ảnh, nhân viên được giao công việc liên quan và quản lý; nhân viên chỉ cập nhật công việc được giao; chỉ quản lý gộp/hủy gộp, phân công, đóng/mở lại. Biết UUID không đồng nghĩa được truy cập tài nguyên. Khi triển khai các chức năng này phải bổ sung kiểm thử theo quan hệ cụ thể.

## 4. Response lỗi thống nhất

| HTTP | Ý nghĩa | `error.code` |
| --- | --- | --- |
| `401` | Thiếu/không hợp lệ/hết hạn phiên đăng nhập. | `UNAUTHENTICATED` |
| `403` | Đã xác thực nhưng chưa đủ điều kiện xác minh hoặc thiếu quyền. | `FORBIDDEN` |

Ví dụ cho người báo gọi hàng đợi quản lý:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Bạn không có quyền truy cập hàng đợi quản lý"
  },
  "requestId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

Không trả stack trace, mã xác minh hoặc thông tin phiên trong response lỗi/log. Khi bị từ chối quyền, không trả kèm dữ liệu hàng đợi và không tạo Report, Issue hoặc nhật ký nghiệp vụ.

## 5. Bảng kiểm thử để Hải Anh review cùng Chúc

**Chuẩn bị:** môi trường phát triển với phiên hợp lệ cho từng vai; người báo A và B để kiểm tra mạo danh. Ba User seed hiện tại chưa có cơ chế đăng nhập; cần có giải pháp xác thực trước khi coi các ca dùng phiên là chạy được. Mỗi ca ghi request, HTTP/response, đối chiếu DB khi liên quan và mã commit. Không ghi cookie/token vào biên bản chia sẻ.

| Mã | Thao tác | Kết quả mong đợi | Kết quả thực tế |
| --- | --- | --- | --- |
| AUTH-01 | Không có phiên, gọi từng endpoint public trong mục 3 với payload hợp lệ. | Đều `401 UNAUTHENTICATED`; không lộ dữ liệu, không ghi nghiệp vụ. | Chưa chạy |
| AUTH-02 | Dùng phiên hết hạn, sai hoặc đã đăng xuất để gửi Report. | `401`; không thêm Report/Issue/IssueEvent. | Chưa chạy |
| AUTH-03 | Có phiên người báo nhưng email chưa xác minh, gửi Report. | `403 FORBIDDEN`; không ghi dữ liệu. | Chưa chạy |
| AUTH-04 | Người báo đã xác minh gửi báo cáo hợp lệ. | `201`; đúng một Report + một Issue `SUBMITTED` + một `REPORT_SUBMITTED`; người gửi/người thực hiện là người trong phiên. | Chưa chạy |
| AUTH-05 | STAFF và MANAGER lần lượt gửi báo cáo hợp lệ. | Mỗi request `201`, dữ liệu ghi đúng chủ thể; không bỏ quyền báo sự cố của hai vai này. | Chưa chạy |
| AUTH-06 | REPORTER và STAFF lần lượt gọi hàng đợi quản lý. | Cả hai `403`; không có `items` chứa dữ liệu hàng đợi trong response lỗi. | Chưa chạy |
| AUTH-07 | MANAGER gọi hàng đợi sau AUTH-04. | `200`, thấy Issue vừa tạo đúng contract. | Chưa chạy |
| AUTH-08 | Người báo A gửi thêm ID của B hoặc `role=MANAGER` trong request/header. | Không thể mạo danh hoặc nâng quyền. Nếu schema từ chối trường ngoài contract thì không ghi; nếu vẫn nhận phần nghiệp vụ hợp lệ thì người gửi luôn là A. Hàng đợi vẫn bị từ chối. | Chưa chạy |
| AUTH-09 | Cả ba vai có phiên hợp lệ gọi gợi ý; sau đó thử khi FastAPI lỗi. | Có quyền gọi; khi AI lỗi trả `200`, `aiStatus=unavailable`, `suggestions=[]`; không tạo Report và không lộ dữ liệu riêng của người khác. | Chưa chạy |
| AUTH-10 | Sau khi quản lý bị thu hồi vai, dùng lại phiên cũ gọi hàng đợi. | `403` nếu phiên còn hợp lệ; `401` nếu giải pháp đăng nhập thu hồi phiên. Tuyệt đối không còn quyền quản lý. | Chưa chạy |
| AUTH-11 | Tự đăng ký với tên miền giả hoặc xin vai MANAGER trong dữ liệu đăng ký. | Tên miền giả bị từ chối; tự đăng ký không thể tạo tài khoản có vai cao hơn REPORTER. | Chưa chạy |

Chỉ ghi **đạt** khi đã gọi API thật. Mở Studio, đổi vai bằng dropdown trên giao diện hoặc chỉ có các dòng User trong DB không chứng minh phân quyền runtime hoạt động.

## 6. Bàn giao và phần cần triển khai tiếp

| Người | Trách nhiệm |
| --- | --- |
| Hải Anh | Giữ quy tắc xác thực/quyền, phối hợp chọn giải pháp đăng nhập và migration bổ sung; chạy/ghi kết quả kiểm thử với Chúc. |
| Chúc | Áp dụng kiểm tra phiên và quyền dùng chung ở API; gán danh tính phía server; bảo đảm giao dịch tạo Report/Issue/nhật ký. |
| Hoàng Anh | Thiết lập cấu hình môi trường đăng nhập khi có giải pháp; kiểm tra lại trên bản chạy chung. |
| Dương/Sơn | Hiển thị trạng thái đăng nhập và phản hồi `401`/`403`; UI theo bảng quyền. |

**Khoảng thiếu so với code hiện tại:** User chưa có trường xác minh email; chưa có lưu phiên hoặc tích hợp dịch vụ xác thực, luồng gửi/xác minh email, khởi tạo quản lý có đăng nhập và nhật ký đổi vai. Cấu trúc cụ thể phụ thuộc giải pháp đăng nhập nên cần migration riêng sau khi chọn. Nhật ký đổi vai thuộc tài khoản, không ghi ép vào `IssueEvent` vì bảng này bắt buộc gắn một Issue.

Ba tài khoản `@demo.invalid` trong seed chỉ là fixture DB. Nếu cần đăng nhập demo trước khi tích hợp xác minh email thật, phải thiết kế chế độ demo riêng, giới hạn môi trường phát triển và ghi rõ các ca xác minh email chưa đạt; không coi chọn vai ở frontend hoặc gửi ID qua header là đăng nhập.

**Lựa chọn kỹ thuật còn phải ghi cụ thể trước khi triển khai:** thư viện/cách xác thực, cách gửi email và thời hạn mã/liên kết, cách lưu/hết hạn phiên cùng migration tương ứng. Yêu cầu xác minh email trước khi dùng API nghiệp vụ đã thống nhất ở mục 1–2. Việc Hải Anh và Chúc duyệt quy tắc không tự xác định các giá trị hoặc công nghệ còn thiếu này.

## 7. Ghi nhận thống nhất

| Ngày | Nội dung | Căn cứ |
| --- | --- | --- |
| 17/11/2026 | Hải Anh và Chúc thống nhất thiết kế Auth/RBAC v1 và bộ tiêu chí kiểm thử trong tài liệu. | Hải Anh xác nhận trong cuộc trao đổi; chưa có biên bản chữ ký riêng đính kèm. |

Sau mốc này, thay đổi quyền, điều kiện xác minh hoặc ý nghĩa lỗi cần được Hải Anh và Chúc ghi lại, cập nhật tài liệu và thông báo các phần bị ảnh hưởng. Chỉ chuyển một ca từ “Chưa chạy” sang “Đạt” khi có bằng chứng kiểm thử API thật.

## Tham khảo kỹ thuật

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): kiểm tra quyền phía server ở mỗi request và chỉ cho phép khi có quy tắc rõ ràng.
- [OWASP Email Validation and Verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html): phân biệt kiểm tra địa chỉ email với xác minh quyền sở hữu email.
