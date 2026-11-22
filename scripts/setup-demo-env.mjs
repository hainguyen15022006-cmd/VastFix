// Tạo .env (từ .env.example nếu chưa có) và thêm mật khẩu demo ngẫu nhiên cho 3 vai.
// Chạy được trên Windows/macOS/Linux:  npm run demo:env
// Không ghi đè giá trị đã có. .env không đưa lên Git.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, appendFileSync } from "node:fs";

if (!existsSync(".env")) copyFileSync(".env.example", ".env");
const current = readFileSync(".env", "utf8");
const added = [];
for (const role of ["REPORTER", "STAFF", "MANAGER"]) {
  const key = `VASTFIX_DEMO_${role}_PASSWORD`;
  if (new RegExp(`^\\s*${key}=`, "m").test(current)) continue;
  added.push(`${key}=${randomBytes(16).toString("hex")}`);
}
if (added.length) {
  appendFileSync(".env", `${current.endsWith("\n") ? "" : "\n"}\n# Mật khẩu phiên demo (chỉ máy này)\n${added.join("\n")}\n`);
  console.log(`Đã thêm ${added.length} mật khẩu demo vào .env.`);
} else {
  console.log(".env đã có đủ mật khẩu demo, không thay đổi.");
}
