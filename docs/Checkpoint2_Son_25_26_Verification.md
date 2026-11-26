# Kiểm chứng Sơn · SO-03/04 (25–26/11/2026)

- `tsc --noEmit`: đạt.
- `npm run build` qua junction `C:\Users\Asus\VastFix`: đạt; Next compile và TypeScript đều đạt, các API route workflow xuất hiện.
- Playwright trên Chrome có sẵn: 15/15 ca trong `tests/ui/manager-workflow-fixture.spec.ts` đạt. Bộ ca gồm sáu trạng thái, POST triage/assign/close/return-work/reopen/return-to-triage với `expectedVersion`, tải lại khi 409 và so sánh gộp disabled. Các ca này mock response API, kiểm UI và payload chứ không kiểm DB thật.
- `scripts/check-workflow-api.mjs` chưa chạy được trên máy này: `embedded-postgres` gọi `initdb.exe` qua đường dẫn OneDrive có Unicode và báo không tìm được binary đi kèm. `docker compose ps` trong môi trường hiện tại cũng bị từ chối quyền kết nối Docker Engine. Vì vậy chưa tuyên bố end-to-end DB/API thật đạt.
- API merge/reverse/upload của Hải Anh chưa xuất hiện trên các nhánh remote đã fetch ngày 26/11. Nút merge giữ disabled theo kế hoạch CP2; chưa thể kiểm thao tác gộp thật hoặc ảnh sau gộp/hủy gộp.
