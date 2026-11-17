import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <header className="brand">VastFix <span>CHECKPOINT 1</span></header>
      <section className="intro">
        <p className="eyebrow">KHUNG ỨNG DỤNG CHUNG</p>
        <h1>Bắt đầu từ một nền tảng chung.</h1>
        <p className="lead">Ứng dụng Next.js đã có khung để nhóm tiếp tục phát triển phần báo sự cố và quản lý xử lý.</p>
      </section>
      <section className="panel" aria-labelledby="next-step">
        <h2 id="next-step">Kiểm tra kết nối dữ liệu</h2>
        <p>Trong môi trường phát triển, mở trang kiểm tra để xác nhận web đọc được các bảng và dữ liệu mẫu trong PostgreSQL.</p>
        <Link className="button" href="/dev/database">Mở trang kiểm tra DB <span aria-hidden="true">→</span></Link>
        <p className="note">Trang kiểm tra chỉ hoạt động khi chạy chế độ phát triển. Đăng nhập và các API nghiệp vụ sẽ được triển khai tiếp.</p>
      </section>
      <footer>VastFix · Nhóm 7 thành viên · USTH</footer>
    </main>
  );
}
