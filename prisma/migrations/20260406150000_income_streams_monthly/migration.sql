-- Recurring streams + monthly income records (replaces single Income table model).

DROP TABLE IF EXISTS "Income" CASCADE;

DROP TYPE IF EXISTS "IncomeFrequency";

CREATE TABLE "IncomeStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "sourceType" "IncomeSourceType" NOT NULL,
    "sourceName" TEXT,
    "salaryPaySchedule" "SalaryPaySchedule",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "tagId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeStream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "incomeStreamId" TEXT,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "tagId" TEXT,
    "sourceType" "IncomeSourceType",
    "sourceName" TEXT,
    "salaryPaySchedule" "SalaryPaySchedule",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Income_incomeStreamId_periodMonth_key" ON "Income"("incomeStreamId", "periodMonth");

CREATE INDEX "IncomeStream_userId_idx" ON "IncomeStream"("userId");

CREATE INDEX "Income_userId_idx" ON "Income"("userId");

CREATE INDEX "Income_periodMonth_idx" ON "Income"("periodMonth");

ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Income" ADD CONSTRAINT "Income_incomeStreamId_fkey" FOREIGN KEY ("incomeStreamId") REFERENCES "IncomeStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Income" ADD CONSTRAINT "Income_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
