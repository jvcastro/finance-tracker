import { addMonths, endOfMonth, startOfMonth } from "date-fns";

import type { PrismaClient } from "@/generated/prisma/client";

import { atNoonLocal, getPaymentDatesForStream } from "@/lib/income-schedule";

/**
 * For each active income stream overlapping `month`, creates Income rows for each
 * scheduled pay date in that month (from pay schedule: monthly, bi-weekly, one-off, etc.).
 */
export async function ensureIncomeRecordsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const streams = await prisma.incomeStream.findMany({
    where: {
      userId,
      isActive: true,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
  });

  for (const stream of streams) {
    const dates = getPaymentDatesForStream(stream, monthStart, monthEnd);
    for (const scheduledDate of dates) {
      const normalized = atNoonLocal(scheduledDate);
      const existing = await prisma.income.findFirst({
        where: {
          userId,
          incomeStreamId: stream.id,
          scheduledDate: normalized,
        },
      });
      if (existing) continue;

      await prisma.income.create({
        data: {
          userId,
          incomeStreamId: stream.id,
          scheduledDate: normalized,
          amount: stream.amount,
          received: false,
          tagId: stream.tagId,
        },
      });
    }
  }
}

/** How many future calendar months after the current month to materialize (inclusive of current). */
const DEFAULT_ROLLING_MONTHS_AHEAD = 3;

/**
 * Ensures payment rows exist for the current month and the next few months so users
 * always see expected income without tapping “Sync”.
 */
export async function ensureIncomeRecordsRollingWindow(
  prisma: PrismaClient,
  userId: string,
  monthsAhead: number = DEFAULT_ROLLING_MONTHS_AHEAD,
) {
  const anchor = startOfMonth(new Date());
  for (let i = 0; i <= monthsAhead; i++) {
    await ensureIncomeRecordsForMonth(prisma, userId, addMonths(anchor, i));
  }
}
