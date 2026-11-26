import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma, Role } from "../../database-starter/generated/prisma/client";
import { ApiError, uuid } from "./api";
import { getDb } from "./db";
import { normalizePhoto, photoPath, removePhotoFile, writePhoto } from "./photo-storage";

type Actor = { id: string; role: Role; emailVerified: boolean };
type Tx = Prisma.TransactionClient;
export const photoDto = (photo: { id: string; mimeType: string; sizeBytes: number; purpose: string }) => ({
  photoId: photo.id, url: "/api/photos/" + photo.id, mimeType: photo.mimeType, sizeBytes: photo.sizeBytes, purpose: photo.purpose,
});

export function photoConflict(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
    throw new ApiError(409, "PHOTO_CONFLICT", "Ảnh hoặc phiếu vừa thay đổi, vui lòng tải lại");
  }
  throw error;
}

async function staffCanRead(tx: Tx, issueId: string, userId: string) {
  return !!await tx.issue.findFirst({
    where: { assigneeId: userId, reviewRequired: false, outgoingMerges: { none: { reversedAt: null } },
      OR: [{ id: issueId }, { incomingMerges: { some: { sourceIssueId: issueId, reversedAt: null } } }] },
    select: { id: true },
  });
}

export async function uploadPhoto(actor: Actor, purpose: string, issueId: string | null, file: File) {
  if (purpose !== "REPORT" && purpose !== "WORK_EVIDENCE") throw new ApiError(400, "BAD_REQUEST", "Mục đích ảnh không hợp lệ");
  if ((purpose === "REPORT" && issueId !== null) || (purpose === "WORK_EVIDENCE" && !uuid(issueId))) {
    throw new ApiError(400, "BAD_REQUEST", "Phiếu đích của ảnh không hợp lệ");
  }
  if (purpose === "WORK_EVIDENCE" && actor.role !== "STAFF") {
    throw new ApiError(403, "FORBIDDEN", "Chỉ nhân viên được giao mới được nộp minh chứng");
  }
  // Check assignment before processing the image; recheck under lock when saving.
  if (purpose === "WORK_EVIDENCE" && !await getDb().issue.findFirst({
    where: { id: issueId!, assigneeId: actor.id, status: "IN_PROGRESS", reviewRequired: false,
      outgoingMerges: { none: { reversedAt: null } } }, select: { id: true },
  })) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy công việc đang xử lý");

  const normalized = await normalizePhoto(Buffer.from(await file.arrayBuffer()), file.type);
  const id = randomUUID(), storageKey = id + "." + normalized.ext;
  await writePhoto(storageKey, normalized.bytes);
  try {
    return await getDb().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, emailVerified: true } });
      if (!user || user.role !== actor.role || user.emailVerified !== actor.emailVerified) {
        throw new ApiError(403, "FORBIDDEN", "Quyền tài khoản vừa thay đổi");
      }
      const drafts = await tx.photo.count({ where: { ownerUserId: actor.id, reportId: null, submissionEventId: null } });
      if (drafts >= 12) throw new ApiError(409, "UPLOAD_LIMIT_REACHED", "Hãy xóa ảnh nháp không dùng trước khi tải thêm");
      if (purpose === "WORK_EVIDENCE") {
        await tx.$queryRaw`SELECT id FROM "Issue" WHERE id = ${issueId}::uuid FOR UPDATE`;
        const issue = await tx.issue.findFirst({
          where: { id: issueId!, assigneeId: actor.id, status: "IN_PROGRESS", reviewRequired: false,
            outgoingMerges: { none: { reversedAt: null } } }, select: { id: true },
        });
        if (!issue) throw new ApiError(409, "WORKFLOW_CONFLICT", "Công việc vừa thay đổi");
        const pending = await tx.photo.count({ where: { issueId: issueId!, ownerUserId: actor.id, purpose, submissionEventId: null } });
        if (pending >= 3) throw new ApiError(409, "UPLOAD_LIMIT_REACHED", "Mỗi lượt nộp có tối đa 3 ảnh minh chứng");
      }
      const saved = await tx.photo.create({ data: {
        id, ownerUserId: actor.id, purpose, issueId, storageKey, mimeType: normalized.mime,
        sizeBytes: normalized.bytes.length, storedAt: new Date(),
      } });
      return photoDto(saved);
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    await removePhotoFile(storageKey);
    return photoConflict(error);
  }
}

export function parseReportPhotoIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3 || !value.every(uuid) || new Set(value.map(id => id.toLowerCase())).size !== value.length) {
    throw new ApiError(400, "INVALID_PHOTOS", "Báo cáo nhận tối đa 3 mã ảnh khác nhau");
  }
  return value as string[];
}

export async function attachReportPhotos(tx: Tx, ownerId: string, reportId: string, ids: string[]) {
  if (!ids.length) return;
  const linked = await tx.photo.updateMany({
    where: { id: { in: ids }, ownerUserId: ownerId, purpose: "REPORT", reportId: null,
      issueId: null, submissionEventId: null, storedAt: { not: null } },
    data: { reportId },
  });
  if (linked.count !== ids.length) throw new ApiError(400, "INVALID_PHOTOS", "Ảnh không thuộc bạn, chưa lưu hoặc đã được sử dụng");
}

export async function readablePhoto(actor: Actor, id: string) {
  if (!uuid(id)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
  return getDb().$transaction(async tx => {
    const photo = await tx.photo.findUnique({ where: { id } });
    if (!photo?.storedAt) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
    let allowed = false;
    if (photo.purpose === "REPORT") {
      if (!photo.reportId) allowed = photo.ownerUserId === actor.id;
      else {
        const report = await tx.report.findUnique({ where: { id: photo.reportId }, select: { reporterId: true, issue: { select: { id: true } } } });
        allowed = actor.role === "MANAGER" || report?.reporterId === actor.id
          || (actor.role === "STAFF" && !!report?.issue && await staffCanRead(tx, report.issue.id, actor.id));
      }
    } else if (photo.issueId) {
      if (!photo.submissionEventId) {
        allowed = photo.ownerUserId === actor.id && actor.role === "STAFF" && await staffCanRead(tx, photo.issueId, actor.id);
      } else {
        allowed = actor.role === "MANAGER" || (actor.role === "STAFF" && await staffCanRead(tx, photo.issueId, actor.id));
        if (!allowed) allowed = !!await tx.issue.findFirst({
          where: { id: photo.issueId, OR: [{ originReport: { reporterId: actor.id } },
            { incomingMerges: { some: { reversedAt: null, source: { originReport: { reporterId: actor.id } } } } }] },
          select: { id: true },
        });
      }
    }
    if (!allowed) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
    photoPath(photo.storageKey);
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
    return photo;
  }, { isolationLevel: "RepeatableRead" });
}

export async function deleteDraftPhoto(actor: Actor, id: string) {
  if (!uuid(id)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
  let storageKey: string;
  try {
    storageKey = await getDb().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Photo" WHERE id = ${id}::uuid FOR UPDATE`;
      const photo = await tx.photo.findUnique({ where: { id } });
      if (!photo || photo.ownerUserId !== actor.id) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy ảnh");
      if (photo.reportId || photo.submissionEventId) throw new ApiError(409, "IMMUTABLE_PHOTO", "Ảnh đã nộp phải được giữ nguyên");
      photoPath(photo.storageKey);
      await tx.photo.delete({ where: { id } });
      return photo.storageKey;
    }, { isolationLevel: "Serializable" });
  } catch (error) { return photoConflict(error); }
  await removePhotoFile(storageKey);
}
