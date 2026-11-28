# VastFix AI · Checkpoint 1

Runtime CP2, checksum, readiness, Docker E5 và kết quả kiểm thử nằm trong [bàn giao Checkpoint 2](../docs/Checkpoint2_AI_Runtime.md).

Thành Lê phụ trách FastAPI xếp hạng ứng viên theo [API contract v1, mục 4.4–4.5](../docs/VastFix_API_Contract_v1_Da_chot_2026-11-16.md). Next.js gửi danh sách ứng viên đã lọc. Dịch vụ AI chỉ dùng dữ liệu trong JSON đó và chạy độc lập với PostgreSQL. Schema `POST /classify` nằm trong contract cho checkpoint sau.

## Chạy dịch vụ

Từ thư mục gốc của repo, dùng Docker Compose để chạy baseline:

```sh
docker compose -f ai-service/compose.yaml up --build --wait
```

Hoặc dùng Python 3.13. Các lệnh sau chạy trong PowerShell, tại thư mục gốc:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Từ thư mục gốc, kiểm tra health và gửi fixture dùng cùng ID, mô tả và vị trí với seed của Hải Anh:

```powershell
curl.exe --fail http://127.0.0.1:8000/health
curl.exe --fail -H "Content-Type: application/json" --data-binary "@ai-service/demo/h2-03.json" http://127.0.0.1:8000/duplicates
```

## Input và output

- `GET /health` trả `{"status":"ok","model_version":"baseline-v1"}` khi dùng baseline.
- `POST /duplicates` nhận `request_id`, `query_time`, `query`, `candidates` và `limit`. [JSON H2-03](demo/h2-03.json) chứa một request đầy đủ. UUID ở dạng chuỗi, thời gian ISO 8601 có múi giờ. Vị trí `INDOOR` có ba ID tòa/tầng/khu vực; `OUTDOOR` có `detail` và có thể gửi cả vĩ độ lẫn kinh độ.
- Response chứa `request_id` của lần gọi, `model_version` và `suggestions`. Mỗi gợi ý có đúng `report_id`, `score` và `reason_codes`. Các ID đến từ request, mỗi ID xuất hiện một lần, tối đa `min(limit, 5)`. Kết quả xếp theo điểm giảm dần, dùng ID để ổn định thứ tự khi bằng điểm. Danh sách đầu vào rỗng hoặc không qua ngưỡng trả `suggestions: []`.
- Bộ mã lý do là `SAME_BUILDING`, `SAME_FLOOR`, `SAME_AREA`, `SIMILAR_DESCRIPTION`, `SAME_CATEGORY`, `RECENT_REPORT`. Next.js chịu trách nhiệm diễn giải cho giao diện. `score` là điểm để xếp hạng.

Điểm pilot gồm 60% độ giống mô tả, 20% vị trí, 10% khớp chi tiết trong cùng khu vực, 5% cùng loại và 5% độ mới. Baseline dùng cosine trên tần suất từ, chuẩn hóa hoa/thường và dấu Việt, giữ nguyên mã tài sản như H2-03 khi tách từ. Trong nhà, cùng khu vực được điểm vị trí cao hơn cùng tầng hoặc cùng tòa. Ngoài trời, mô tả vị trí trùng hoặc tọa độ gần nhau được cộng điểm. Tuổi ứng viên tính từ `query_time`; tín hiệu thời gian giảm một nửa mỗi 7 ngày. Ngưỡng điểm pilot mặc định 0,35, có thể đổi bằng `VASTFIX_DUPLICATE_MIN_SCORE`. Chỉ phát mã `SIMILAR_DESCRIPTION` khi cosine đạt 0,45 với baseline hoặc 0,80 với embedding. Các ngưỡng này cần được rà lại khi có dữ liệu nhóm đã duyệt.

## Bàn giao tích hợp

- **Chúc:** trên nhánh backend, đặt `FASTAPI_BASE_URL=http://127.0.0.1:8000` khi Next.js cũng chạy trên máy host. Khi đưa hai service vào cùng Compose, dùng hostname nội bộ của service AI. Giữ `DUPLICATE_TIMEOUT_MS=5000` làm mốc pilot. Với DB đã migrate và seed, đăng nhập demo, gọi `POST /api/duplicate-suggestions` cho A1/tầng 2/hành lang giữa, chi tiết H2-03. Xác nhận ID `55555555-5555-4555-8555-555555555555` đứng trên ứng viên H2-04. Dừng AI rồi thử lại để thấy `aiStatus: "unavailable"`, sau đó gửi Report qua `POST /api/reports`. Chạy lại theo [hướng dẫn nền dữ liệu](../database-starter/TEAM_HANDOFF.md).
- **Dương:** dùng fixture để đối chiếu mã lý do với Chúc. Payload phía trình duyệt dùng camelCase theo contract, riêng giao tiếp Next.js → AI dùng snake_case.
- **Công Thành và Hải Anh:** dùng [bộ thử và kết quả sơ bộ](evaluation/README.md) để review. Khi có bộ nhãn của Công Thành, đối chiếu lại trên cùng quy tắc truy vấn và ứng viên.

### Kết quả tích hợp local

Đã chạy nhánh Chúc tại commit `8cd69d3` với PostgreSQL 17, áp dụng đủ ba migration, chạy seed và `db:verify` thành công. Cả baseline và embedding đều đưa H2-03 đứng trên H2-04 qua endpoint Next.js. Khi FastAPI dừng hoặc phản hồi sau mốc 5 giây, Next.js trả `aiStatus: "unavailable"`. Sau hai ca fallback, API tạo Report trả 201 và Issue mới xuất hiện trong hàng đợi quản lý. Ca timeout trả về sau khoảng 5,04 giây.

Máy thử dùng Windows, Python 3.13 và CPU Intel 6 luồng logic. Mỗi dòng bên dưới đo 10 request trên loopback sau khi dịch vụ sẵn sàng.

| Đường gọi | Ứng viên | Trung vị | Cao nhất |
| --- | ---: | ---: | ---: |
| Next.js → PostgreSQL → FastAPI baseline | 2 | 32 ms | 80 ms |
| Next.js → PostgreSQL → FastAPI embedding | 2 | 39 ms | 58 ms |
| FastAPI embedding trực tiếp, lặp hai mô tả seed với ID riêng | 50 | 250 ms | 295 ms |

Giữ timeout pilot 5 giây theo contract. Số đo với mô tả seed ngắn và tải tuần tự phục vụ kiểm tra tích hợp. Docker Compose đã qua `config`; bước chạy container cần máy có Docker Engine.

## Thử embedding Việt–Anh

Baseline đủ chạy demo trên CPU và dùng bộ phụ thuộc nhỏ. Để đo thêm embedding, cài phụ thuộc tùy chọn và tải một lần khoảng 135 MB tệp mô hình từ bản [ONNX lượng tử hóa đã ghim](https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78) của [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small). Từ `ai-service/`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-embedding.txt
New-Item -ItemType Directory -Force .venv/e5-small | Out-Null
$model = 'https://huggingface.co/Xenova/multilingual-e5-small/resolve/761b726dd34fb83930e26aab4e9ac3899aa1fa78'
curl.exe --fail --location "$model/tokenizer.json" --output .venv/e5-small/tokenizer.json
curl.exe --fail --location "$model/onnx/model_quantized.onnx" --output .venv/e5-small/model_quantized.onnx
.\.venv\Scripts\python.exe -m evaluation.run --embedding-dir .venv/e5-small
```

Bỏ `--embedding-dir` để chạy các baseline. Nếu muốn gọi embedding qua HTTP, đặt `$env:VASTFIX_EMBEDDING_DIR = '.venv/e5-small'` trước lệnh Uvicorn ở trên. Model chạy CPU bằng ONNX Runtime và báo phiên bản `multilingual-e5-small-q8-v1`. Khi chạy service, dữ liệu mô tả và mô hình được xử lý tại máy. Gỡ biến môi trường và khởi động lại để dùng baseline cho demo.
