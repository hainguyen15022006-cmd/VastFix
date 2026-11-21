import "server-only";
import nodemailer from "nodemailer";

export async function sendVerificationEmail(email: string, url: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.MAIL_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || !from) throw new Error("Missing SMTP configuration");
  const transporter = nodemailer.createTransport({
    host, port, secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    ...(process.env.NODE_ENV === "production" ? { requireTLS: true } : {}),
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
  });
  await transporter.sendMail({
    from, to: email, subject: "VastFix - Xác minh địa chỉ email",
    text: `Bạn vừa đăng ký VastFix. Mở liên kết để xác minh email (hết hạn sau 1 giờ):\n\n${url}\n\nNếu bạn không đăng ký, có thể bỏ qua thư này.`,
  });
}
