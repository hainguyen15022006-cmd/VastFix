import type { NextRequest } from "next/server";
import { body, handle, json } from "@/lib/api";
import { requireWorkflowRole, type IssueContext } from "@/lib/workflow/http";
import { reverseMerge } from "@/lib/workflow/merges";

export function POST(request: NextRequest, context: IssueContext) {
  return handle(async requestId => {
    const actor = await requireWorkflowRole(request, "MANAGER");
    const { id } = await context.params;
    return json({ ...await reverseMerge(actor, id, await body(request)), requestId });
  });
}
