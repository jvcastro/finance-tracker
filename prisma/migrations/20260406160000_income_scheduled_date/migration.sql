-- Income rows use a pay date (scheduledDate) so bi-weekly streams can have multiple rows per month.

ALTER TABLE "Income" ADD COLUMN "scheduledDate" TIMESTAMP(3);

UPDATE "Income" SET "scheduledDate" = "periodMonth" WHERE "scheduledDate" IS NULL;

ALTER TABLE "Income" ALTER COLUMN "scheduledDate" SET NOT NULL;

DROP INDEX IF EXISTS "Income_incomeStreamId_periodMonth_key";
DROP INDEX IF EXISTS "Income_periodMonth_idx";

ALTER TABLE "Income" DROP COLUMN "periodMonth";

CREATE UNIQUE INDEX "Income_incomeStreamId_scheduledDate_key" ON "Income"("incomeStreamId", "scheduledDate");

CREATE INDEX "Income_scheduledDate_idx" ON "Income"("scheduledDate");
