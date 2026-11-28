-- CreateEnum
CREATE TYPE "PhotoPurpose" AS ENUM ('REPORT', 'WORK_EVIDENCE');

-- CreateTable
CREATE TABLE "Photo" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "issueId" UUID,
    "reportId" UUID,
    "submissionEventId" UUID,
    "purpose" "PhotoPurpose" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");

-- CreateIndex
CREATE INDEX "Photo_ownerUserId_createdAt_idx" ON "Photo"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_issueId_idx" ON "Photo"("issueId");

-- CreateIndex
CREATE INDEX "Photo_reportId_idx" ON "Photo"("reportId");

-- CreateIndex
CREATE INDEX "Photo_submissionEventId_idx" ON "Photo"("submissionEventId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_submissionEventId_fkey" FOREIGN KEY ("submissionEventId") REFERENCES "IssueEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
