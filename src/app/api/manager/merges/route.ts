import type { NextRequest } from "next/server";
import { body, handle, json } from "@/lib/api";
import { requireWorkflowRole } from "@/lib/workflow/http";
import { mergeIssues } from "@/lib/workflow/merges";

export function POST(request: NextRequest) {
  return handle(async requestId => {
    const actor = await requireWorkflowRole(request, "MANAGER");
    return json({ ...await mergeIssues(actor, await body(request)), requestId }, 201);
  });
}
