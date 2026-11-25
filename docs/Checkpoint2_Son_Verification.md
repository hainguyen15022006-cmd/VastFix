# Sơn · Kiểm chứng SO-01/02

- Đối chiếu kế hoạch CP2 trang 13–14, contract đề xuất của Chúc commit `11809a6`, queue và auth CP1.
- `tsc --noEmit`: đạt trên Node 24.11.1. `npm run build` qua junction `C:\Users\Asus\VastFix`: đạt, gồm Next compile, TypeScript và route `/[locale]/manager/issues/[id]`.
- `npm run typecheck` trong sandbox từ đường dẫn OneDrive có dấu bị SWC Windows từ chối canonicalize; build ngoài sandbox qua junction đã chạy TypeScript thành công. Đây là lỗi đường dẫn/quyền của môi trường.
- Playwright Chrome: 23/23 ca đạt trên queue cũ và fixture detail sáu trạng thái + 404. Fixture chỉ mô phỏng API, không chứng minh workflow backend thật.
- Chưa kiểm tích hợp API CP2 trên stack vì stack hiện vẫn là `main` CP1 và nhánh workflow API chưa được merge.
