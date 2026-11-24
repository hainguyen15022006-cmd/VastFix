import { ApiError } from "@/lib/api";
import { Prisma } from "../../../database-starter/generated/prisma/client";

// CP2 photo persistence boundary. See the contract and test fixture for the proposed
// shape. The storage team owns the migration, upload and authorized file reads.
type PhotoLink = { id: string; reportId: string | null; submissionEventId: string | null };

async function photoStorageReady(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ ready: boolean }[]>`
    SELECT to_regclass('"Photo"') IS NOT NULL AS ready
  `;
  return row.ready;
}

async function requirePhotoStorage(tx: Prisma.TransactionClient) {
  if (!await photoStorageReady(tx)) {
    throw new ApiError(503, "PHOTO_STORAGE_UNAVAILABLE", "Dịch vụ lưu ảnh minh chứng chưa sẵn sàng");
  }
}

export async function readPhotoLinks(tx: Prisma.TransactionClient, issueId: string, reportIds: string[]) {
  if (!await photoStorageReady(tx)) return [];
  return tx.$queryRaw<PhotoLink[]>`
    SELECT id, "reportId", "submissionEventId" FROM "Photo"
    WHERE "storedAt" IS NOT NULL AND (
      (purpose = 'REPORT' AND "reportId" IN (${Prisma.join(reportIds.map(id => Prisma.sql`${id}::uuid`))}))
      OR (purpose = 'WORK_EVIDENCE' AND "issueId" = ${issueId}::uuid AND "submissionEventId" IS NOT NULL)
    )
    ORDER BY "createdAt", id
  `;
}

export async function attachEvidence(
  tx: Prisma.TransactionClient, issueId: string, userId: string, eventId: string, photoIds: string[],
) {
  await requirePhotoStorage(tx);
  const linked = await tx.$executeRaw`
    UPDATE "Photo" SET "submissionEventId" = ${eventId}::uuid
    WHERE id IN (${Prisma.join(photoIds.map(id => Prisma.sql`${id}::uuid`))})
      AND "issueId" = ${issueId}::uuid AND "ownerUserId" = ${userId}::uuid
      AND purpose = 'WORK_EVIDENCE' AND "reportId" IS NULL AND "submissionEventId" IS NULL
      AND "storedAt" IS NOT NULL
  `;
  if (linked !== photoIds.length) throw new ApiError(400, "INVALID_EVIDENCE", "Ảnh minh chứng không hợp lệ");
}

export async function hasEvidence(tx: Prisma.TransactionClient, issueId: string, eventId: string) {
  await requirePhotoStorage(tx);
  const [row] = await tx.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "Photo" WHERE "issueId" = ${issueId}::uuid
        AND "submissionEventId" = ${eventId}::uuid AND purpose = 'WORK_EVIDENCE' AND "storedAt" IS NOT NULL
    ) AS present
  `;
  return row.present;
}
