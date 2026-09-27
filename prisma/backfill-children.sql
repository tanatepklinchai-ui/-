-- Existing database: execute this file, then run `npx prisma db push`.
-- Fresh database: run only `npx prisma db push`; there is no legacy data to backfill.
-- This file adds nullable child links and backfills them before Prisma enforces them.
CREATE TABLE IF NOT EXISTS "Child" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "gender" TEXT,
  "weight" DOUBLE PRECISION,
  "height" DOUBLE PRECISION,
  "dob" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Child_userId_idx" ON "Child"("userId");
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "childId" TEXT;
ALTER TABLE "VaccineRecord" ADD COLUMN IF NOT EXISTS "childId" TEXT;

INSERT INTO "Child" (
  "id",
  "userId",
  "firstName",
  "lastName",
  "gender",
  "weight",
  "height",
  "dob",
  "createdAt",
  "updatedAt"
)
SELECT
  profile."id",
  profile."userId",
  profile."firstName",
  profile."lastName",
  profile."gender",
  profile."weight",
  profile."height",
  profile."dob",
  profile."updatedAt",
  profile."updatedAt"
FROM "Profile" AS profile
WHERE NOT EXISTS (
  SELECT 1 FROM "Child" WHERE "Child"."userId" = profile."userId"
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Child" ("id", "userId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, records."userId", NOW(), NOW()
FROM (
  SELECT "userId" FROM "Appointment" WHERE "childId" IS NULL
  UNION
  SELECT "userId" FROM "VaccineRecord" WHERE "childId" IS NULL
) AS records
WHERE NOT EXISTS (
  SELECT 1 FROM "Child" WHERE "Child"."userId" = records."userId"
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Appointment" AS appointment
SET "childId" = profile."id"
FROM "Profile" AS profile
WHERE appointment."userId" = profile."userId"
  AND appointment."childId" IS NULL
  AND EXISTS (SELECT 1 FROM "Child" WHERE "Child"."id" = profile."id");

UPDATE "VaccineRecord" AS record
SET "childId" = profile."id"
FROM "Profile" AS profile
WHERE record."userId" = profile."userId"
  AND record."childId" IS NULL
  AND EXISTS (SELECT 1 FROM "Child" WHERE "Child"."id" = profile."id");

UPDATE "Appointment" AS appointment
SET "childId" = child."id"
FROM "Child" AS child
WHERE appointment."userId" = child."userId"
  AND appointment."childId" IS NULL;

UPDATE "VaccineRecord" AS record
SET "childId" = child."id"
FROM "Child" AS child
WHERE record."userId" = child."userId"
  AND record."childId" IS NULL;