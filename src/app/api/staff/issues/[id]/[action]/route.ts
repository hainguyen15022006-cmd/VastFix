import type { NextRequest } from "next/server";
import { workflowAction, type WorkflowContext } from "@/lib/workflow/http";

export function POST(request: NextRequest, context: WorkflowContext) {
  return workflowAction("STAFF", request, context);
}
