-- Rename legacy `date` to `startDate` and add optional `endDate`.
ALTER TABLE "Income" RENAME COLUMN "date" TO "startDate";
ALTER TABLE "Income" ADD COLUMN "endDate" TIMESTAMP(3);
