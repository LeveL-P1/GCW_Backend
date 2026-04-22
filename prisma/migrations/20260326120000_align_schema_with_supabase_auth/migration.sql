ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
DROP COLUMN IF EXISTS "emailVerificationToken",
DROP COLUMN IF EXISTS "emailVerified",
DROP COLUMN IF EXISTS "lastLogin",
DROP COLUMN IF EXISTS "passwordResetToken",
DROP COLUMN IF EXISTS "passwordResetTokenExpires",
DROP COLUMN IF EXISTS "password_hash";

UPDATE "User"
SET "email" = CONCAT('placeholder+', "id", '@local.invalid')
WHERE "email" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "email" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

ALTER TABLE "Session"
ADD COLUMN IF NOT EXISTS "name" TEXT;

ALTER TABLE "SessionParticipant"
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR';

WITH ranked_participants AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "sessionId", "userId"
      ORDER BY "joinedAt" DESC, "id" DESC
    ) AS row_num
  FROM "SessionParticipant"
)
DELETE FROM "SessionParticipant"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_participants
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionParticipant_sessionId_userId_key"
ON "SessionParticipant"("sessionId", "userId");

CREATE INDEX IF NOT EXISTS "SessionParticipant_userId_idx"
ON "SessionParticipant"("userId");

CREATE INDEX IF NOT EXISTS "EventLog_sessionId_timestamp_idx"
ON "EventLog"("sessionId", "timestamp");

CREATE INDEX IF NOT EXISTS "MetricsSnapshot_sessionId_timestamp_idx"
ON "MetricsSnapshot"("sessionId", "timestamp");
