CREATE TABLE "DemoSession" (
  "tokenHash" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");
