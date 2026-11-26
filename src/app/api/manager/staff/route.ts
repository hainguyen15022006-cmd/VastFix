import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireWorkflowRole } from "@/lib/workflow/http";

export function GET(request: NextRequest) {
  return handle(async requestId => {
    await requireWorkflowRole(request, "MANAGER");
    const items = await getDb().user.findMany({
      where: { role: "STAFF", emailVerified: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    return json({ items, requestId });
  });
}
