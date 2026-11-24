import type { NextRequest } from "next/server";
import { workflowDetail, type IssueContext } from "@/lib/workflow/http";

export function GET(request: NextRequest, context: IssueContext) {
  return workflowDetail("MANAGER", request, context);
}
