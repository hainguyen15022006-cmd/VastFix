"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, localMail }: { mode: "register" | "login"; localMail: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    try {
      const result = register
        ? await authClient.signUp.email({ name: String(data.get("name")).trim(), email, password, callbackURL: "/login" })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.code === "EMAIL_NOT_VERIFIED"
          ? "Bạn cần xác minh email trước khi đăng nhập. Kiểm tra thư xác minh hoặc bấm gửi lại bên dưới."
          : result.error.message || "Không thực hiện được. Vui lòng thử lại.");
        form.querySelector<HTMLInputElement>("input")?.focus();
      } else if (register) {
        setNotice("Nếu đăng ký hợp lệ, thư xác minh đã được gửi. Mở thư, bấm liên kết rồi quay lại đăng nhập.");
        form.reset();
      } else {
        router.push("/account"); router.refresh();
      }
    } catch { setError("Không kết nối được máy chủ. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  async function resend(form: HTMLFormElement) {
    const email = String(new FormData(form).get("email") || "").trim();
    if (!email) { setError("Nhập email trước khi gửi lại thư xác minh."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/login" });
      if (result.error) setError("Không gửi được thư xác minh. Kiểm tra email và thử lại.");
      else setNotice("Nếu tài khoản cần xác minh, thư đã được gửi. Vui lòng kiểm tra hộp thư.");
    } catch { setError("Không kết nối được máy chủ."); }
    finally { setBusy(false); }
  }

  return (
    <main className="shell auth-shell">
      <header className="brand">VastFix <span>TÀI KHOẢN</span></header>
      <Link href="/" className="back">← Về trang đầu</Link>
      <h1>{register ? "Tạo tài khoản VastFix" : "Đăng nhập"}</h1>
      <p>{register ? "Dùng email USTH của bạn. Tài khoản mới có vai người báo sự cố." : "Đăng nhập sau khi đã xác minh địa chỉ email."}</p>
      <form className="panel auth-form" onSubmit={submit}>
        {error && <p role="alert" className="status failure">{error}</p>}
        {notice && <p role="status" className="status success">{notice}</p>}
        {register && <label>Họ tên<input name="name" autoComplete="name" required maxLength={100} /></label>}
        <label>Email USTH<input name="email" type="email" autoComplete="email" required placeholder="tenban@usth.edu.vn" aria-describedby="email-help" /></label>
        <p className="note" id="email-help">Chỉ địa chỉ có tên miền usth.edu.vn.</p>
        <label>Mật khẩu<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? "password-help" : undefined} /></label>
        {register && <p className="note" id="password-help">Từ 12 đến 128 ký tự. Bạn có thể dùng trình quản lý mật khẩu.</p>}
        <button className="button" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : register ? "Đăng ký và nhận thư xác minh" : "Đăng nhập"}</button>
        {!register && <button className="text-button" type="button" disabled={busy} onClick={event => void resend(event.currentTarget.form!)}>Gửi lại thư xác minh</button>}
      </form>
      <p>{register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}<Link href={register ? "/login" : "/register"}>{register ? "Đăng nhập" : "Đăng ký"}</Link></p>
      {localMail && <p className="status">Môi trường thử: email được giữ trong <a href="http://127.0.0.1:8025" target="_blank" rel="noreferrer">Mailpit trên máy này</a>, không gửi tới hộp thư USTH thật.</p>}
    </main>
  );
}
