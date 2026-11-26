import type { NextRequest } from "next/server";
import { ApiError, body, handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { requestLocale } from "@/lib/request-locale";
import { applyWorkflow, managerActions, staffActions } from "./actions";
import { issueDetail } from "./queries";
import { reviewAfterUnmerge } from "./merges";

type Role = "MANAGER" | "STAFF";
export type IssueContext = { params: Promise<{ id: string }> };
export type WorkflowContext = { params: Promise<{ id: string; action: string }> };

export async function requireWorkflowRole(request: NextRequest, role: Role) {
  const user = await currentUser(request);
  if (user.role !== role) throw new ApiError(403, "FORBIDDEN", "Vai trò không có quyền thực hiện thao tác này");
  const origin = request.headers.get("origin");
  if (request.method === "POST" && origin && origin !== new URL(process.env.BETTER_AUTH_URL || request.url).origin) {
    throw new ApiError(403, "FORBIDDEN", "Nguồn yêu cầu không hợp lệ");
  }
  return user;
}

export function workflowDetail(role: Role, request: NextRequest, context: IssueContext) {
  return handle(async requestId => {
    const user = await requireWorkflowRole(request, role);
    const { id } = await context.params;
    const issue = await issueDetail(id, requestLocale(request, user.locale), role === "STAFF" ? user.id : undefined);
    return json({ issue, requestId });
  });
}

export function workflowAction(role: Role, request: NextRequest, context: WorkflowContext) {
  return handle(async requestId => {
    const user = await requireWorkflowRole(request, role);
    const { id, action: slug } = await context.params;
    if (role === "MANAGER" && slug === "review-after-unmerge") {
      return json({ ...await reviewAfterUnmerge(user, id, await body(request)), requestId });
    }
    const action = (role === "MANAGER" ? managerActions : staffActions).find(value => value === slug);
    if (!action) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy thao tác");
    const data = await applyWorkflow(user, id, action, await body(request));
    return json({ ...data, requestId });
  });
}
