import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { requestLocale } from "@/lib/request-locale";
import { requireWorkflowRole } from "@/lib/workflow/http";
import { staffQueue } from "@/lib/workflow/queries";

export function GET(request: NextRequest) {
  return handle(async requestId => {
    const user = await requireWorkflowRole(request, "STAFF");
    const queue = await staffQueue(request, user.id, requestLocale(request, user.locale));
    return json({ ...queue, requestId });
  });
}
