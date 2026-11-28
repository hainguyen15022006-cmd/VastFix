import type { NextRequest } from "next/server";
import { ApiError } from "./api";
import { maxUploadBodyBytes } from "./photo-storage";

export function requirePhotoOrigin(request: NextRequest) {
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (request.headers.get("origin") !== expected) throw new ApiError(403, "FORBIDDEN", "Nguồn yêu cầu không hợp lệ");
}

export async function uploadForm(request: NextRequest) {
  const type = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data;.*boundary=/i.test(type)) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Cần gửi multipart/form-data");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxUploadBodyBytes)) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "Dữ liệu tải lên vượt quá giới hạn");
  }
  if (!request.body) throw new ApiError(400, "BAD_REQUEST", "Thiếu nội dung ảnh");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxUploadBodyBytes) {
        await reader.cancel();
        throw new ApiError(413, "UPLOAD_TOO_LARGE", "Dữ liệu tải lên vượt quá giới hạn");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": type } }).formData(); }
  catch { throw new ApiError(400, "BAD_REQUEST", "Dữ liệu tải ảnh không hợp lệ"); }
  const allowed = new Set(["file", "purpose", "issueId"]);
  for (const key of form.keys()) {
    if (!allowed.has(key) || form.getAll(key).length !== 1) throw new ApiError(400, "BAD_REQUEST", "Trường tải ảnh không hợp lệ hoặc bị lặp");
  }
  const file = form.get("file"), purpose = form.get("purpose"), issueId = form.get("issueId");
  if (!(file instanceof File) || typeof purpose !== "string" || (issueId !== null && typeof issueId !== "string")) {
    throw new ApiError(400, "BAD_REQUEST", "Cần một tệp ảnh và mục đích sử dụng");
  }
  return { file, purpose, issueId };
}
