-- CreateTable
CREATE TABLE "ExpenseStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "tagId" TEXT,
    "paymentDay" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseStream_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "expenseStreamId" TEXT;

-- CreateIndex
CREATE INDEX "ExpenseStream_userId_idx" ON "ExpenseStream"("userId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseStreamId_date_key" ON "Expense"("expenseStreamId", "date");

-- AddForeignKey
ALTER TABLE "ExpenseStream" ADD CONSTRAINT "ExpenseStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseStream" ADD CONSTRAINT "ExpenseStream_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseStreamId_fkey" FOREIGN KEY ("expenseStreamId") REFERENCES "ExpenseStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
