# Thử nghiệm gợi ý trùng Việt–Anh · Checkpoint 1

[Bộ thử tổng hợp](fixtures.csv) có 38 mô tả viết cho lần chạy kỹ thuật này, gồm 36 mô tả thuộc 9 cụm sự cố, một ca tái phát và một ca không chắc. Các mô tả, vị trí, mã loại và thời điểm đều giả lập. Đây là bộ thử tạm trong khi chờ bộ dữ liệu và baseline chính thức của Công Thành. Dữ liệu demo A1/H2-03 được lưu riêng trong [fixture API](../demo/h2-03.json).

Hai mô tả thuộc cùng cụm khi nói về cùng đối tượng, cùng biểu hiện hỏng và cùng lần sự cố. Hai bóng H2-03/H2-04 ở cùng hành lang, hai vòi lavabo trái/phải hoặc khóa/bản lề của cùng cửa là các ca dễ nhầm. Lần hỏng cũ `L03-OLD-1` đã đóng trước đợt tái phát và được loại khỏi tập ứng viên lúc chấm. Ca `UNKNOWN-1` thiếu thông tin xác định bóng nào và được bỏ khỏi phép đo.

## Cách đo

Chạy `python -m evaluation.run --embedding-dir <thư_mục_model>` trong `ai-service` theo [hướng dẫn cài đặt](../README.md). Script dùng các mô tả có timestamp sớm hơn, còn mở, đã có nhãn và cùng tòa làm ứng viên. Từng mô tả được dùng làm truy vấn khi có ít nhất một ứng viên trùng. Nhóm Việt–Anh gồm cả hai hướng truy vấn. Mỗi nhóm ngôn ngữ chỉ chấm truy vấn có ít nhất một đáp án trùng trong chính nhóm đó.

Recall@k là phần đáp án trùng tìm thấy trong k mục đầu, lấy trung bình theo truy vấn. MRR là trung bình nghịch đảo thứ hạng của đáp án trùng đầu tiên trên toàn danh sách. Phép đo thứ hạng sử dụng ngưỡng điểm 0 để quan sát thứ tự đầy đủ. Endpoint demo áp dụng ngưỡng 0,35 và giới hạn 5 theo cấu hình pilot.

## Kết quả sơ bộ

| Xếp hạng | Nhóm | Truy vấn | Recall@3 | Recall@5 | MRR |
| --- | --- | ---: | ---: | ---: | ---: |
| Chỉ vị trí | Tất cả | 27 | 0,673 | 0,877 | 0,699 |
| Chỉ từ khóa | Tất cả | 27 | 0,383 | 0,444 | 0,609 |
| Baseline v1 | Tất cả | 27 | 0,704 | 0,827 | 0,772 |
| E5-small Q8 | Tất cả | 27 | 0,815 | 0,975 | 0,778 |
| Baseline v1 | Việt–Việt | 9 | 1,000 | 1,000 | 1,000 |
| E5-small Q8 | Việt–Việt | 9 | 1,000 | 1,000 | 0,759 |
| Baseline v1 | Anh–Anh | 9 | 1,000 | 1,000 | 0,796 |
| E5-small Q8 | Anh–Anh | 9 | 1,000 | 1,000 | 0,870 |
| Baseline v1 | Việt–Anh | 27 | 0,963 | 1,000 | 0,870 |
| E5-small Q8 | Việt–Anh | 27 | 0,963 | 1,000 | 0,889 |

Trên lần chạy CPU, xếp hạng trung bình mất khoảng **0,51 ms** với baseline và **113 ms** với embedding. Số đo bao gồm mã hóa văn bản với E5, tính điểm và sắp xếp. Kết nối HTTP, truy vấn DB và tải model lúc khởi động nằm ngoài phép đo này.

Embedding giữ được nhiều đáp án đúng hơn trong top 5 chung. MRR Việt–Việt giảm trên 9 truy vấn, và hai phương pháp có cùng Recall@3 và Recall@5 Việt–Anh trong bộ này. Vị trí và chi tiết được viết nhất quán trong dữ liệu giả lập nên so sánh có thể lạc quan hơn khi dùng phản ánh thực tế. Chưa có đánh giá ngưỡng điểm, nhãn độc lập hoặc kết quả cuối kỳ.

## Phần nói trong khoảng 2 phút

1. Mở ca H2-03 ở A1/tầng 2/hành lang giữa. Chỉ vào kết quả H2-03 đứng trên H2-04 và giải thích tín hiệu vị trí, độ giống mô tả và mã bóng. Đây là hai bóng khác nhau.
2. Nêu ca Việt–Anh đúng `WIFI-2 → WIFI-1`. “Wi-Fi trong phòng B101 cứ rớt kết nối” cùng sự cố với mô tả tiếng Anh về Wi-Fi liên tục ngắt ở phòng 101.
3. Trình bày hai lỗi đứng đầu của E5. `L03-2` đặt `L04-1` trên `L03-1` khi mô tả chỉ nói “third ceiling light” và hai đèn cùng hành lang. `LOCK-2` đặt `HINGE-1` trên `LOCK-1` dù kẹt ổ khóa và lỏng bản lề là hai biểu hiện khác nhau của cùng một cửa.
4. Kết bằng Recall@5 chung **0,827 → 0,975** trên 27 truy vấn tổng hợp, cùng bước kiểm tra kế tiếp với dữ liệu được Công Thành duyệt.
