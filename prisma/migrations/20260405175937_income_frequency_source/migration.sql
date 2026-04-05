-- CreateEnum
CREATE TYPE "IncomeFrequency" AS ENUM ('ONE_TIME', 'MONTHLY');

-- CreateEnum
CREATE TYPE "IncomeSourceType" AS ENUM ('SALARY', 'PROJECT', 'OTHER');

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "frequency" "IncomeFrequency" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceType" "IncomeSourceType" NOT NULL DEFAULT 'OTHER';
