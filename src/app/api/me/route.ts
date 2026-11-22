import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";

export function GET(request: NextRequest) {
  return handle(async requestId => {
    const user = await currentUser(request);
    return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified }, requestId });
  });
}
