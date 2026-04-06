-- AlterTable
ALTER TABLE "ExpenseStream" ADD COLUMN "bankId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "bankId" TEXT;

-- CreateIndex
CREATE INDEX "ExpenseStream_bankId_idx" ON "ExpenseStream"("bankId");

-- CreateIndex
CREATE INDEX "Expense_bankId_idx" ON "Expense"("bankId");

-- AddForeignKey
ALTER TABLE "ExpenseStream" ADD CONSTRAINT "ExpenseStream_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
