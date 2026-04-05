ALTER TABLE "IncomeStream" ADD COLUMN "paymentDay" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "IncomeStream" ADD COLUMN "secondPaymentDay" INTEGER;

UPDATE "IncomeStream" SET "secondPaymentDay" = 30 WHERE "salaryPaySchedule" = 'BI_WEEKLY';
