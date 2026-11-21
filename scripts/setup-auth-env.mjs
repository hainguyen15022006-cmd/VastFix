import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

let contents = existsSync(".env") ? readFileSync(".env", "utf8") : readFileSync(".env.example", "utf8");
function add(key, value) {
  if (!new RegExp(`^${key}=.+$`, "m").test(contents)) {
    contents = contents.replace(new RegExp(`^${key}=.*\\n?`, "gm"), "");
    contents += `\n${key}=${value}\n`;
  }
}
add("BETTER_AUTH_SECRET", randomBytes(48).toString("base64url"));
add("BETTER_AUTH_URL", "http://127.0.0.1:3000");
add("SMTP_HOST", "127.0.0.1"); add("SMTP_PORT", "1025"); add("SMTP_SECURE", "false");
add("MAIL_FROM", '"VastFix Dev <noreply@vastfix.test>"');
add("VASTFIX_DEMO_AUTH", "0");
writeFileSync(".env", contents, { mode: 0o600 });
console.log("Đã bổ sung cấu hình auth còn thiếu trong .env. Không in secret; không ghi đè giá trị đã có.");
