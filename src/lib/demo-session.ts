import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "./db";
import { ApiError } from "./api";

export const cookieName = "vastfix-demo";
export const demoEmails = ["reporter@demo.invalid", "staff@demo.invalid", "manager@demo.invalid"];
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function demoEnabled(request: NextRequest) {
  return process.env.NODE_ENV === "development" && process.env.VASTFIX_DEMO_AUTH === "1"
    && ["127.0.0.1", "localhost", "[::1]"].includes(request.nextUrl.hostname);
}

export async function currentUser(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (demoEnabled(request) && token) {
    const session = await getDb().demoSession.findUnique({
      where: { tokenHash: digest(token) }, include: { user: true },
    });
    if (session && session.expiresAt > new Date() && demoEmails.includes(session.user.email)) return session.user;
  }
  throw new ApiError(401, "UNAUTHENTICATED", "Cần đăng nhập");
}
