// QA helper (CP2): grant STAFF to a verified account on a development DB, with an audit row.
// Stopgap until the team's official role-management flow exists (QA-05). Not for production.
import { prisma } from "../database-starter/src/db";

async function main() {
  const [staffEmail, managerEmail] = process.argv.slice(2).map(value => value?.trim().toLowerCase());
  if (!staffEmail?.endsWith("@usth.edu.vn") || !managerEmail?.endsWith("@usth.edu.vn"))
    throw new Error("Dùng: npm run qa:grant-staff -- staff@usth.edu.vn manager@usth.edu.vn");
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1|db):/.test(url)) throw new Error("Chỉ chạy trên DB phát triển (localhost/127.0.0.1/db).");
  await prisma.$transaction(async tx => {
    const manager = await tx.user.findUnique({ where: { email: managerEmail } });
    if (manager?.role !== "MANAGER" || !manager.emailVerified) throw new Error("Người cấp phải là MANAGER đã xác minh.");
    const user = await tx.user.findUnique({ where: { email: staffEmail } });
    if (!user?.emailVerified) throw new Error("Tài khoản phải đăng ký và xác minh email trước.");
    if (user.role !== "REPORTER") throw new Error(`Tài khoản đang là ${user.role}; chỉ đổi REPORTER → STAFF.`);
    await tx.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
    await tx.userRoleEvent.create({ data: {
      subjectUserId: user.id, actorUserId: manager.id, fromRole: "REPORTER", toRole: "STAFF",
      reason: "QA CP2: cấp vai STAFF cho tài khoản kiểm thử (tạm thời, chờ quy trình chính thức)",
    } });
  });
  console.log("Đã cấp vai STAFF và ghi nhật ký đổi vai.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
