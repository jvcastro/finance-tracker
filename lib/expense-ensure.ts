import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";

import type { PrismaClient } from "@/generated/prisma/client";
import { atNoonLocal, getPaymentDatesForStream, type StreamLike } from "@/lib/income-schedule";

function expenseStreamToStreamLike(stream: {
  startDate: Date;
  endDate: Date | null;
  paymentDay: number;
}): StreamLike {
  return {
    sourceType: "PROJECT",
    salaryPaySchedule: null,
    startDate: stream.startDate,
    endDate: stream.endDate,
    paymentDay: stream.paymentDay,
    secondPaymentDay: null,
  };
}

type ExpenseRowForDedupe = {
  id: string;
  expenseStreamId: string | null;
  date: Date;
  paid: boolean;
  createdAt: Date;
};

function duplicateKey(row: ExpenseRowForDedupe): string {
  const day = format(row.date, "yyyy-MM-dd");
  if (row.expenseStreamId != null) {
    return `s:${row.expenseStreamId}:${day}`;
  }
  return `m:${day}`;
}

function pickKeeperId(
  rows: Array<{ id: string; paid: boolean; createdAt: Date }>,
): string {
  const paidRows = rows.filter((r) => r.paid);
  const pool = paidRows.length > 0 ? paidRows : rows;
  return [...pool].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0].id;
}

export async function dedupeExpenseRecordsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const rows = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: monthStart, lte: monthEnd },
    },
    select: {
      id: true,
      expenseStreamId: true,
      date: true,
      paid: true,
      createdAt: true,
    },
  });

  const groups = new Map<string, ExpenseRowForDedupe[]>();
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
    await prisma.expense.deleteMany({
      where: { userId, id: { in: idsToDelete } },
    });
  }
}

export async function ensureExpenseRecordsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const streams = await prisma.expenseStream.findMany({
    where: {
      userId,
      isActive: true,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
  });

  for (const stream of streams) {
    const dates = getPaymentDatesForStream(
      expenseStreamToStreamLike(stream),
      monthStart,
      monthEnd,
    );
    for (const d of dates) {
      const normalized = atNoonLocal(d);
      await prisma.expense.createMany({
        data: [
          {
            userId,
            expenseStreamId: stream.id,
            date: normalized,
            amount: stream.amount,
            description: stream.description,
            tagId: stream.tagId,
            bankId: stream.bankId,
            paymentMethod: stream.paymentMethod,
            paid: false,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  await dedupeExpenseRecordsForMonth(prisma, userId, month);
  await syncExpenseRecordsFromStreamsForMonth(prisma, userId, month);
}

/**
 * Pushes current stream fields onto existing expense rows for that stream in this month.
 * Does not change paid status.
 */
export async function syncExpenseRecordsFromStreamsForMonth(
  prisma: PrismaClient,
  userId: string,
  month: Date,
) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const rows = await prisma.expense.findMany({
    where: {
      userId,
      expenseStreamId: { not: null },
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { id: true, expenseStreamId: true },
  });
  if (rows.length === 0) return;

  const streamIds = [...new Set(rows.map((r) => r.expenseStreamId!))];
  const streams = await prisma.expenseStream.findMany({
    where: { userId, id: { in: streamIds } },
  });
  const byId = new Map(streams.map((s) => [s.id, s]));

  const ops = [];
  for (const row of rows) {
    const stream = byId.get(row.expenseStreamId!);
    if (!stream) continue;
    ops.push(
      prisma.expense.update({
        where: { id: row.id },
        data: {
          amount: stream.amount,
          description: stream.description,
          tagId: stream.tagId,
          bankId: stream.bankId,
          paymentMethod: stream.paymentMethod,
        },
      }),
    );
  }
  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }
}

const DEFAULT_ROLLING_MONTHS_AHEAD = 3;

export async function ensureExpenseRecordsRollingWindow(
  prisma: PrismaClient,
  userId: string,
  monthsAhead: number = DEFAULT_ROLLING_MONTHS_AHEAD,
) {
  const anchor = startOfMonth(new Date());
  for (let i = 0; i <= monthsAhead; i++) {
    await ensureExpenseRecordsForMonth(prisma, userId, addMonths(anchor, i));
  }
}
