# Thành Lê · Bàn giao AI Checkpoint 2

Nhánh `feat/cp2-ai-runtime` xuất phát từ `main@6e33c1b`. Tài liệu này ghi kết quả kỹ thuật và phần cần người nhận xác nhận trước nghiệm thu. Contract thành công của `/duplicates` và `/health` tiếp tục dùng schema v1.

## Runtime và tái lập

`VASTFIX_AI_RUNTIME=baseline|e5` chọn chế độ tường minh. Khi bỏ biến này, đường dẫn `VASTFIX_EMBEDDING_DIR` tiếp tục bật E5 theo cách chạy CP1. Khi chọn baseline tường minh, đường dẫn model không ảnh hưởng lựa chọn.

E5 dùng ONNX CPU, revision và SHA-256 trong [manifest](../ai-service/model-manifest.json). Trước tải, dịch vụ kiểm kích thước và checksum từng file rồi chạy warm-up. `/ready` và `/health` trả 200 khi sẵn sàng. Nếu thiếu file, sai checksum hoặc load lỗi, cả hai trả 503 với phiên bản model yêu cầu, còn `/duplicates` trả 503 `MODEL_UNAVAILABLE`. Backend xử lý HTTP lỗi theo fallback v1. Tokenizer/inference được khóa khi chạy đồng thời để tránh tranh chấp trạng thái và giới hạn CPU.

Từ thư mục gốc, cài Python 3.13 và chạy:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r ai-service/requirements-dev.txt -r ai-service/requirements-embedding.txt
.venv/Scripts/python.exe ai-service/prepare_model.py .venv/e5-small
.venv/Scripts/python.exe ai-service/benchmark_runtime.py --model-dir .venv/e5-small
```

Hoàng Anh ghép overlay vào stack chung, sau khi chuẩn bị biến môi trường theo README của stack:

```powershell
docker compose -f compose.yaml -f ai-service/compose.e5.yaml up -d --build --wait
```

Model bind-mount chỉ đọc, lưu ngoài Git. Overlay đọc `VASTFIX_MODEL_DIR`, mặc định `./.venv/e5-small`. Các tệp model được chuẩn bị trước buổi demo. Cấu hình Compose đã validate bằng biến giả, Docker Engine trên máy Thành Lê hiện thiếu nên chạy container ghi NOT RUN. Các số đo dưới đây dùng HTTP Uvicorn trực tiếp.

## Bằng chứng runtime

[Output đo](../ai-service/evaluation/checkpoint2/runtime.json) trên Windows 11, Python 3.13.2, CPU 6 luồng logic, 50 candidates tạo bằng cách lặp hai mô tả seed với ID khác nhau. Mỗi lượt gồm 10 request tuần tự và 12 request với 4 worker.

| Phép đo | Baseline | E5 |
| --- | ---: | ---: |
| Khởi động tiến trình và ready, model đã có trên đĩa | 0,95 s | 3,45 s |
| Trung vị request tuần tự | 4,58 ms | 216,86 ms |
| Lớn nhất với 4 request đồng thời | 17,06 ms | 997,68 ms |
| Sau restart E5, lớn nhất đồng thời | — | 1.140,46 ms |

Các request có cùng query_time/config cho cùng output. Model thiếu trả 503. Test riêng kiểm sai checksum, schema v1, thứ tự/giới hạn/ID và baseline đồng thời. Tổng 18 test FastAPI PASS. Bộ evaluator 12 test PASS sau sửa UTF-8/LF để checksum dataset ổn định trên Windows. Sửa này chỉ liên quan đọc/ghi byte, nội dung và nhãn giữ nguyên.

Tích hợp với bản QA `a438978` chạy trong checkout thử riêng bằng Next.js dev, PostgreSQL tạm, Better Auth thật và E5 trên HTTP loopback. Suite dựa trên `scripts/check-merge-api.mjs` của Hải Anh, thay fixture bằng proxy ghi candidates rồi chuyển request sang E5, kiểm version/ID/top 5 của output thật. Các ca merge/reverse dùng API thật. [Script tái lập](../ai-service/tests/integration/check-cp2-ai.mjs) chạy từ repo QA đã cài dependencies và generate Prisma. Sao chép script vào `scripts/check-cp2-ai.mjs` ở repo QA, bật E5 ở cổng 18481 rồi chạy `node scripts/check-cp2-ai.mjs`. Script tự tạo và dừng DB/web thử.

## Chất lượng và lựa chọn đề xuất O-CP2-04

Chạy evaluator của Công Thành bằng:

```powershell
.venv/Scripts/python.exe -X utf8 evaluation/duplicate-detection/evaluate.py --data evaluation/duplicate-detection/dataset.ai-reviewed.json --embedding-dir .venv/e5-small --api
```

[Kết quả](../ai-service/evaluation/checkpoint2/evaluation.json) dùng 41 mô tả tổng hợp, 22 ca gồm 14 AI_REVIEWED và 8 UNCERTAIN. Có 9 ca positive đủ điều kiện để đo thứ hạng. Baseline và E5 cùng Recall@3 = Recall@5 = 1,000, MRR = 0,889. Chế độ `--api` của evaluator hiện kiểm endpoint baseline; benchmark HTTP riêng kiểm E5 thật. Phép lọc `--reviewed-only` trả [0 ca nhãn người](../ai-service/evaluation/checkpoint2/human-reviewed.json).

Đề xuất giữ baseline mặc định, timeout 5 giây và threshold 0,35 cho bản chung trong lúc chờ pilot có nhãn độc lập và kiểm Docker E5. Overlay E5 sẵn sàng để QA thử. Số đo hiện tại hỗ trợ tính khả thi CPU; hai model có cùng MRR trên tập rất nhỏ này. Threshold chưa được chọn trên tuning theo cụm, nên giữ giá trị CP1 và đánh dấu chờ đánh giá. Quyết định chung cần Công Thành, Chúc và Hoàng Anh xác nhận.

## Bàn giao và phần còn cần xác nhận

| Việc | Bằng chứng hoặc trạng thái |
| --- | --- |
| TL-01/02 manifest, cấu hình, wire fixture | Có trong ai-service; dùng demo/h2-03.json |
| TL-03 E5 HTTP, readiness, độ trễ | PASS local; Docker NOT RUN |
| TL-04 A01 CLOSED/merge/reverse | PASS API trên bản QA a438978 với E5 thật; xem merge-integration.json |
| TL-05 D01 pilot có nhãn người/split theo cụm | Chờ dữ liệu Công Thành; kết quả tổng hợp đã lưu |
| TL-06 A02 model thiếu/checksum/restart/concurrent | PASS runtime local; web CP2 nhận 503/timeout vẫn tạo Report, PASS |
| TL-07 phụ lục và demo | Có bên dưới; người nhận xác nhận sau khi ghép |

Mỗi lần ghép cần ghi commit, môi trường, PASS/FAIL/NOT RUN. PR cá nhân và bằng chứng local là đầu vào cho Hoàng Anh tích hợp. Hải Anh xác nhận nghiệm thu theo kế hoạch.

[Bằng chứng tích hợp](../ai-service/evaluation/checkpoint2/merge-integration.json) ghi 12 nhóm PASS, gồm fallback 503 và timeout trên CP2. Lỗi AI được tạo có kiểm soát ở proxy; E5 thiếu file được kiểm riêng qua HTTP runtime. Bộ đánh giá endpoint baseline có 2/5 ca chỉ chứa negative vẫn trả gợi ý, nên threshold 0,35 còn cần rà với pilot có nhãn độc lập.

## Kịch bản nói 2 phút

Mở fixture H2-03 để chỉ ra ID bóng đúng đứng trên H2-04. Giải thích điểm gồm nội dung, vị trí, chi tiết đối tượng, loại và độ mới tính bằng query_time. Mã lý do phản ánh từng tín hiệu hỗ trợ.

Tiếp theo, dùng hai bóng cùng hành lang để giải thích lỗi nhầm đối tượng. Câu “hành lang tầng hai tối” thiếu thông tin bóng nào, giữ trạng thái không chắc trong đánh giá. Trình bày số lượng mẫu và nguồn nhãn cùng bảng kết quả, mở /health để chỉ rõ model đang chạy.

Kết bằng giới hạn pilot nhỏ, nhu cầu nhãn độc lập và kế hoạch classify ở checkpoint sau. Quyết định gộp vẫn thuộc quản lý.

## Phần đóng góp dữ liệu của Thành Lê

Bản nháp dưới đây được AI soạn, nguồn SYNTHETIC, chưa có quan sát thực hoặc người duyệt. Thành Lê cần kiểm tra và gửi Công Thành theo mẫu nhóm.

- Đối tượng giả lập TL-CP2-01, cửa phòng thực hành A1/tầng 2/phòng 205, bản lề dưới bị lỏng. Thời điểm sự cố chưa xác định.
- Bốn cách diễn đạt Việt — “Bản lề dưới cửa phòng 205 bị lỏng”; “Cửa phòng 205 bị xệ ở khớp dưới”; “Vít bản lề phía dưới cửa phòng thực hành 205 bị tuột”; “Đóng cửa phòng 205 thì cánh bị lệch vì bản lề dưới lỏng”.
- Một mô tả Anh — “The lower hinge on the door of lab 205 is loose and the door sags.”
- Negative khó — ổ khóa của cùng cửa bị kẹt, cần xác minh có phải cùng nguyên nhân và lần hỏng hay không.

Công Thành và Hoàng Anh đọc độc lập cụm Thành Lê; Hải Anh hòa giải nếu lệch. Thành Lê có lượt đọc cụm Dương, Sơn và hòa giải cụm Chúc theo trang 21. Các lượt này chờ người thật thực hiện và ghi nhận.
