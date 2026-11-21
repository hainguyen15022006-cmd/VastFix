import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError, body, handle, json } from "@/lib/api";
import { cookieName, demoEmails, demoEnabled, digest } from "@/lib/demo-session";
import { getDb } from "@/lib/db";

function localRequest(request: NextRequest) {
  if (!demoEnabled(request)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy");
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) throw new ApiError(403, "FORBIDDEN", "Nguồn không hợp lệ");
}

export function POST(request: NextRequest) {
  return handle(async requestId => {
    localRequest(request);
    const { email, password } = await body(request);
    const allowed = typeof email === "string" && demoEmails.includes(email);
    const secret = allowed ? process.env["VASTFIX_DEMO_" + email.split("@")[0].toUpperCase() + "_PASSWORD"] : undefined;
    if (!allowed || !secret || typeof password !== "string" ||
        !timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(digest(password)))) {
      throw new ApiError(401, "UNAUTHENTICATED", "Thông tin đăng nhập không hợp lệ");
    }
    const db = getDb();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Tài khoản demo chưa tồn tại");
    const token = randomBytes(32).toString("hex");
    const ttl = 3600;
    await db.$transaction([
      db.demoSession.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      db.demoSession.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + ttl * 1000) } }),
    ]);
    const response = json({ role: user.role, requestId });
    response.cookies.set(cookieName, token, { httpOnly: true, sameSite: "strict", path: "/api", maxAge: ttl });
    return response;
  });
}

export function DELETE(request: NextRequest) {
  return handle(async requestId => {
    localRequest(request);
    const token = request.cookies.get(cookieName)?.value;
    if (token) await getDb().demoSession.deleteMany({ where: { tokenHash: digest(token) } });
    const response = json({ requestId });
    response.cookies.set(cookieName, "", { path: "/api", maxAge: 0 });
    return response;
  });
}
