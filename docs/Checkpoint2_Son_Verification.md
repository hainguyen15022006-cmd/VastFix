# Sơn · Kiểm chứng SO-01/02

- Đối chiếu kế hoạch CP2 trang 13–14, contract đề xuất của Chúc commit `11809a6`, queue và auth CP1.
- `tsc --noEmit`: đạt trên Node 24.11.1. `npm run build` qua junction `C:\Users\Asus\VastFix`: đạt, gồm Next compile, TypeScript và route `/[locale]/manager/issues/[id]`.
- `npm run typecheck` trong sandbox từ đường dẫn OneDrive có dấu bị SWC Windows từ chối canonicalize; build ngoài sandbox qua junction đã chạy TypeScript thành công. Đây là lỗi đường dẫn/quyền của môi trường.
- Playwright Chrome: 23/23 ca đạt trên queue cũ và fixture detail sáu trạng thái + 404. Fixture chỉ mô phỏng API, không chứng minh workflow backend thật.
- Chưa kiểm tích hợp API CP2 trên stack vì stack hiện vẫn là `main` CP1 và nhánh workflow API chưa được merge.

## Bổ sung SO-05/06/07 · 27–29/11

- `tsc --noEmit` và `npm run build` qua junction: đạt.
- Playwright Chrome: 17/17 ca manager detail đạt; thêm 6 ca queue/detail về mobile, bàn phím, quyền mất, đổi locale và hủy request khi refresh đều đạt. Các ca dùng fixture API.
- Đã fetch remote trước khi làm: chưa có endpoint merge/reverse/review hoặc `mergeId` trong detail. Vì vậy chưa thể kiểm gộp → hủy → rà lại trên DB, relogin sau gộp hay ảnh trước/sau gộp thật.
- Script API thật vẫn bị `embedded-postgres` trên đường dẫn OneDrive có Unicode chặn như `docs/Checkpoint2_Son_25_26_Verification.md`; không dùng kết quả fixture để tuyên bố API thật đạt.
