-- Legacy CP2 fixture before 20261126000000_photo_storage.
-- Do not execute alongside production migrations; check-workflow-api now uses the real migration.
CREATE TABLE "Photo" (
  "id" UUID PRIMARY KEY,
  "ownerUserId" UUID NOT NULL REFERENCES "User"("id"),
  "issueId" UUID REFERENCES "Issue"("id"),
  "reportId" UUID REFERENCES "Report"("id"),
  "submissionEventId" UUID REFERENCES "IssueEvent"("id"),
  "purpose" TEXT NOT NULL CHECK ("purpose" IN ('REPORT', 'WORK_EVIDENCE')),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "storedAt" TIMESTAMPTZ(3)
);
