ALTER TABLE "Hospital"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Appointment"
ADD COLUMN "usesCapacity" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Appointment"
SET "usesCapacity" = false
WHERE "isWaitlisted" = true;

ALTER TABLE "Appointment"
ALTER COLUMN "usesCapacity" SET DEFAULT false;
