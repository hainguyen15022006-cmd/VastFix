import { prisma } from "../database-starter/src/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.endsWith("@usth.edu.vn")) throw new Error("Dùng: npm run auth:bootstrap-manager -- email@usth.edu.vn");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(732019)::text`;
    const existing = await tx.user.count({ where: { role: "MANAGER", emailVerified: true } });
    if (existing) throw new Error("Đã có quản lý đã xác minh. Không dùng quy trình bootstrap lần nữa.");
    const user = await tx.user.findUnique({ where: { email } });
    if (!user?.emailVerified) throw new Error("Tài khoản phải đăng ký và xác minh email trước.");
    await tx.user.update({ where: { id: user.id }, data: { role: "MANAGER" } });
    await tx.userRoleEvent.create({ data: {
      subjectUserId: user.id, fromRole: user.role, toRole: "MANAGER",
      reason: "Initial manager bootstrap by database operator",
    } });
  });
  console.log("Đã khởi tạo quản lý đầu tiên và ghi nhật ký đổi vai.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
