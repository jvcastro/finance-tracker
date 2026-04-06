-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('MANUAL', 'BANK_AUTO_DEBIT', 'CARD_AUTO_PAY');

-- AlterTable
ALTER TABLE "ExpenseStream" ADD COLUMN "paymentMethod" "ExpensePaymentMethod" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" "ExpensePaymentMethod" NOT NULL DEFAULT 'MANUAL';
