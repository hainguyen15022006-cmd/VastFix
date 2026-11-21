import "server-only";
import type { NextRequest } from "next/server";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { currentUser as demoUser } from "./demo-session";
import { ApiError } from "./api";

export async function currentUser(request: NextRequest) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return demoUser(request); // Existing explicit local-demo checks remain in demo-session.ts.
  const user = await getDb().user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Cần đăng nhập");
  if (!user.emailVerified) throw new ApiError(403, "FORBIDDEN", "Cần xác minh email");
  return user; // Read current role from DB on every protected request.
}
