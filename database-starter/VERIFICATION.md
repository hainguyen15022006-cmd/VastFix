# Trạng thái kiểm tra bộ nền dữ liệu

Ngày kiểm tra: 17/11/2026.

- Đã cài dependencies, có package-lock.json; Prisma CLI/Client/adapter cùng phiên bản 7.10.1.
- `npm run db:validate`: đạt.
- `npm run db:generate`: đạt.
- `npm run typecheck`: đạt.
- `docker compose -f compose.database.yaml config --quiet`: đạt.
- Migration đầu được sinh từ schema bằng `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.

## Kiểm tra lại sau khi Hải Anh chạy các bước hướng dẫn

- PostgreSQL 17 trong Docker: đang chạy, trạng thái `healthy`, kết nối qua `127.0.0.1:5433`.
- `prisma migrate status --config prisma7.config.ts`: tìm thấy 1 migration và báo `Database schema is up to date!`.
- `npm run db:verify` trên DB thật: đạt. Có đủ 3 User demo tương ứng REPORTER/STAFF/MANAGER; 2 Report mẫu liên kết với 2 Issue SUBMITTED, mỗi Issue có đúng 1 sự kiện REPORT_SUBMITTED và vị trí thuộc A1.

Phần nền schema → migration → seed đã có bằng chứng chạy thật trên máy này. Lần kiểm tra lại chỉ đọc trạng thái và dữ liệu, không chạy lại seed; chưa kiểm chứng việc chạy seed hai lần giữ nguyên toàn bộ dữ liệu. Chưa có API web, đăng nhập, phân quyền runtime hoặc luồng gộp/hủy gộp trong bộ thực hành này.


## Bổ sung seed checkpoint ngày 22/11/2026

Seed hiện có ba báo cáo với ID cố định: H2-03, H2-04 tại hành lang tầng 2 và TAP-1 rò nước tại nhà vệ sinh tầng 1. Thêm PLUMBING minh họa. Toàn bộ upsert giữ update={} để không sửa nội dung Report cũ. verify kiểm tra đủ ba Report, ba Issue SUBMITTED, một event tạo cho mỗi phiếu và tầng tương ứng. Đây là dữ liệu demo A1, không suy ra cơ sở USTH thực tế từ danh mục này.
