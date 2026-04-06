-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "attachmentKey" TEXT,
ADD COLUMN "attachmentMime" TEXT;

-- AlterTable
ALTER TABLE "Income" ADD COLUMN "attachmentKey" TEXT,
ADD COLUMN "attachmentMime" TEXT;
