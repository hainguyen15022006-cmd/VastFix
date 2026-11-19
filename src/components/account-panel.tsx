"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type User = { id: string; name: string; email: string; role: string; emailVerified: boolean };
const roleNames: Record<string, string> = { REPORTER: "Người báo sự cố", STAFF: "Nhân viên", MANAGER: "Quản lý" };

export function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error("Không đọc được tài khoản. Kiểm tra trạng thái xác minh email.");
      setUser((await response.json()).user);
    }).catch(error => { if (error.name !== "AbortError") setError(error.message); });
    return () => controller.abort();
  }, [router]);
  async function logout() {
    setBusy(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Chưa đăng xuất được. Vui lòng thử lại.");
      router.replace("/login"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Lỗi kết nối"); }
    finally { setBusy(false); }
  }
  return <main className="shell">
    <header className="brand">VastFix <span>TÀI KHOẢN CỦA BẠN</span></header>
    <Link href="/" className="back">← Về trang đầu</Link>
    <h1>Tài khoản đang đăng nhập</h1>
    {error && <p role="alert" className="status failure">{error}</p>}
    {user ? <section className="panel">
      <dl><dt>Họ tên</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Vai trò</dt><dd>{roleNames[user.role] || user.role}</dd><dt>Xác minh email</dt><dd>{user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</dd></dl>
      <button className="button" onClick={logout} disabled={busy}>{busy ? "Đang đăng xuất…" : "Đăng xuất"}</button>
    </section> : !error && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}
  </main>;
}
