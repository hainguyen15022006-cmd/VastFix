import { ApiError } from "@/lib/api";
import type { Prisma } from "../../../database-starter/generated/prisma/client";

export function requiredText(value: unknown, name: string, maxLength = 5000): string {
  if (typeof value === "string" && value.trim() && value.length <= maxLength) return value;
  throw new ApiError(400, "BAD_REQUEST", "Trường không hợp lệ: " + name);
}

export function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseDueAt(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    const date = new Date(value), day = new Date(value.slice(0, 10) + "T00:00:00Z");
    if (Number.isFinite(date.getTime()) && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10)) return date;
  }
  throw new ApiError(400, "BAD_REQUEST", "dueAt phải là thời điểm ISO 8601 có múi giờ");
}

export async function triageFields(tx: Prisma.TransactionClient, input: Record<string, unknown>) {
  const categoryCode = requiredText(input.categoryCode, "categoryCode", 100);
  const { priority } = input;
  if (priority !== "P0" && priority !== "P1" && priority !== "P2") throw new ApiError(400, "BAD_REQUEST", "Mức ưu tiên không hợp lệ");
  const dueAt = parseDueAt(input.dueAt);
  const category = await tx.category.findUnique({ where: { code: categoryCode }, select: { id: true } });
  if (!category) throw new ApiError(400, "INVALID_CATEGORY", "Loại sự cố không hợp lệ");
  return { data: { confirmedCategoryId: category.id, priority, dueAt } satisfies Prisma.IssueUncheckedUpdateInput,
    details: { categoryCode, priority, dueAt: dueAt.toISOString() } };
}
