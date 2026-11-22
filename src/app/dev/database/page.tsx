import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function readCounts() {
  try {
    const db = getDb();
    const counts = await db.$transaction([
      db.user.count(), db.building.count(), db.floor.count(), db.area.count(),
      db.category.count(), db.report.count(), db.issue.count(), db.issueEvent.count(),
    ]);
    return { ok: true as const, counts };
  } catch {
    return { ok: false as const };
  }
}

export default async function DatabaseCheck() {
  if (process.env.NODE_ENV !== "development") notFound();
  const result = await readCounts();
  const tables = ["User", "Building", "Floor", "Area", "Category", "Report", "Issue", "IssueEvent"];
  return (
    <main className="shell">
      <header className="brand">VastFix <span>KIỂM TRA PHÁT TRIỂN</span></header>
      <Link className="back" href="/">← Về trang đầu</Link>
      <h1>Web đọc được DB chưa?</h1>
      <p className={`status ${result.ok ? "success" : "failure"}`}>
        {result.ok ? "Đã kết nối PostgreSQL và đọc được 8 bảng." : "Chưa đọc được DB. Kiểm tra Docker, DATABASE_URL và migration."}
      </p>
      <p>Số liệu được đọc từ DB khi mở hoặc tải lại trang. Trang chỉ hiển thị tổng số bản ghi.</p>
      {result.ok && (
        <div className="table-wrap"><table>
          <caption>Số bản ghi hiện tại</caption>
          <thead><tr><th scope="col">Bảng</th><th scope="col">Số bản ghi</th></tr></thead>
          <tbody>{tables.map((name, index) => <tr key={name}><th scope="row">{name}</th><td>{result.counts[index]}</td></tr>)}</tbody>
        </table></div>
      )}
      <p className="note">Bộ seed nguyên trạng có 3 User, 2 Report, 2 Issue và 2 IssueEvent. Nếu bạn đã thêm dữ liệu khác, tổng số có thể cao hơn. Trang này chưa kiểm tra đăng nhập hoặc quyền truy cập nghiệp vụ.</p>
      <footer>Trang nội bộ để kiểm tra khi phát triển · Không hoạt động trong bản production.</footer>
    </main>
  );
}
