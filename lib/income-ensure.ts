import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";

import type { PrismaClient } from "@/generated/prisma/client";

import { atNoonLocal, getPaymentDatesForStream } from "@/lib/income-schedule";

type IncomeRowForDedupe = {
  id: string;
  incomeStreamId: string | null;
  scheduledDate: Date;
  received: boolean;
  createdAt: Date;
};

function duplicateKey(row: IncomeRowForDedupe): string {
  const day = format(row.scheduledDate, "yyyy-MM-dd");
  if (row.incomeStreamId != null) {
    return `s:${row.incomeStreamId}:${day}`;
  }
  return `m:${day}`;
}

/** Prefer a received row when duplicates exist; otherwise keep the oldest row. */
function pickKeeperId(rows: IncomeRowForDedupe[]): string {
  const received = rows.filter((r) => r.received);
  const pool = received.length > 0 ? received : rows;
  pool.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return pool[0].id;
}

/**
 * Removes rows that share the same logical key (stream + pay date, or manual + date).
 * Called after materializing so login / parallel requests can’t leave stale duplicates.
 */
export async function dedupeIncomeRecordsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const rows = await prisma.income.findMany({
    where: {
      userId,
      scheduledDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      incomeStreamId: true,
      scheduledDate: true,
      received: true,
      createdAt: true,
    },
  });

  const groups = new Map<string, IncomeRowForDedupe[]>();
  for (const row of rows) {
    const k = duplicateKey(row);
    const list = groups.get(k) ?? [];
    list.push(row);
    groups.set(k, list);
  }

  const idsToDelete: string[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const keeperId = pickKeeperId(group);
    for (const row of group) {
      if (row.id !== keeperId) idsToDelete.push(row.id);
    }
  }

  if (idsToDelete.length > 0) {
    await prisma.income.deleteMany({
      where: { userId, id: { in: idsToDelete } },
    });
  }
}

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
      // Use skipDuplicates so concurrent list/sync calls can't insert twice (check-then-insert races).
      await prisma.income.createMany({
        data: [
          {
            userId,
            incomeStreamId: stream.id,
            scheduledDate: normalized,
            amount: stream.amount,
            received: false,
            tagId: stream.tagId,
            financialAccountId: stream.financialAccountId,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  await dedupeIncomeRecordsForMonth(prisma, userId, month);
  await syncIncomeRecordsFromStreamsForMonth(prisma, userId, month);
}

/**
 * Pushes current stream fields (amount, tag, account, description) onto existing payment
 * rows for that stream in this month so “Sync month” reflects recurring edits.
 * Does not change received status.
 */
export async function syncIncomeRecordsFromStreamsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const rows = await prisma.income.findMany({
    where: {
      userId,
      incomeStreamId: { not: null },
      scheduledDate: { gte: monthStart, lte: monthEnd },
    },
    select: { id: true, incomeStreamId: true },
  });
  if (rows.length === 0) return;

  const streamIds = [...new Set(rows.map((r) => r.incomeStreamId!))];
  const streams = await prisma.incomeStream.findMany({
    where: { userId, id: { in: streamIds } },
  });
  const byId = new Map(streams.map((s) => [s.id, s]));

  const ops = [];
  for (const row of rows) {
    const stream = byId.get(row.incomeStreamId!);
    if (!stream) continue;
    ops.push(
      prisma.income.update({
        where: { id: row.id },
        data: {
          amount: stream.amount,
          tagId: stream.tagId,
          financialAccountId: stream.financialAccountId,
          description: stream.description,
        },
      }),
    );
  }
  if (ops.length > 0) {
    await prisma.$transaction(ops);
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
