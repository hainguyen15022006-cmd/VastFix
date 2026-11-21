import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handle(action: (requestId: string) => Promise<Response>) {
  const requestId = crypto.randomUUID();
  try {
    return await action(requestId);
  } catch (cause) {
    const error = cause instanceof ApiError ? cause : new ApiError(500, "INTERNAL_ERROR", "Lỗi máy chủ");
    if (error.status === 500) console.error("API request failed", requestId);
    return json({ error: { code: error.code, message: error.message }, requestId }, error.status);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function body(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new ApiError(400, "BAD_REQUEST", "JSON không hợp lệ"); }
  if (!isRecord(value)) throw new ApiError(422, "VALIDATION_ERROR", "Cần một đối tượng JSON");
  return value;
}

export function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}
