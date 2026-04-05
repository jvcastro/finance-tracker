-- CreateEnum
CREATE TYPE "SalaryPaySchedule" AS ENUM ('MONTHLY', 'BI_WEEKLY', 'ONE_OFF');

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "salaryPaySchedule" "SalaryPaySchedule";
