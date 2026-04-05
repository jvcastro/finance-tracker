import {
  addMonths,
  endOfMonth,
  format,
  isWithinInterval,
  startOfMonth,
  subMonths,
} from "date-fns";

import { ensureIncomeRecordsRollingWindow } from "@/lib/income-ensure";
import { sumExpectedIncomeFromStreamsInMonth } from "@/lib/income-schedule";
import { router, protectedProcedure } from "@/server/trpc";

function sumInMonth<T extends { date: Date; amount: unknown }>(
  rows: T[],
  monthStart: Date,
  monthEnd: Date,
) {
  return rows.reduce((s, r) => {
    if (isWithinInterval(r.date, { start: monthStart, end: monthEnd })) {
      return s + Number(r.amount);
    }
    return s;
  }, 0);
}

type IncomeRecordWithStream = {
  amount: unknown;
  scheduledDate: Date;
  received: boolean;
  sourceType: string | null;
  salaryPaySchedule: string | null;
  incomeStream: {
    sourceType: string;
    salaryPaySchedule: string | null;
  } | null;
};

function resolveSourceType(row: IncomeRecordWithStream) {
  return (row.incomeStream?.sourceType ?? row.sourceType ?? "OTHER") as
    | "SALARY"
    | "PROJECT"
    | "OTHER";
}

function resolveSalarySchedule(row: IncomeRecordWithStream) {
  return row.incomeStream?.salaryPaySchedule ?? row.salaryPaySchedule;
}

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    await ensureIncomeRecordsRollingWindow(ctx.prisma, userId);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [
      incomeRecords,
      incomeStreams,
      expenses,
      debts,
      expenseMonth,
      debtMonth,
    ] = await Promise.all([
      ctx.prisma.income.findMany({
        where: { userId },
        include: { incomeStream: true, tag: true },
      }),
      ctx.prisma.incomeStream.findMany({ where: { userId, isActive: true } }),
      ctx.prisma.expense.findMany({ where: { userId } }),
      ctx.prisma.creditCardDebt.findMany({ where: { userId } }),
      ctx.prisma.expense.findMany({
        where: {
          userId,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      ctx.prisma.creditCardDebt.findMany({
        where: {
          userId,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    const recordsThisMonth = incomeRecords.filter((r) =>
      isWithinInterval(r.scheduledDate, { start: monthStart, end: monthEnd }),
    );

    const totalIncome = incomeRecords.reduce((s, i) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalDebtPayments = debts.reduce((s, d) => s + Number(d.amount), 0);

    const incomeThisMonth = recordsThisMonth.reduce(
      (s, i) => s + Number(i.amount),
      0,
    );
    const expenseThisMonth = expenseMonth.reduce(
      (s, e) => s + Number(e.amount),
      0,
    );
    const debtPaymentsThisMonth = debtMonth.reduce(
      (s, d) => s + Number(d.amount),
      0,
    );

    const netLifetime = totalIncome - totalExpense - totalDebtPayments;
    const netThisMonth =
      incomeThisMonth - expenseThisMonth - debtPaymentsThisMonth;

    const incomeBySourceThisMonth = {
      SALARY: 0,
      PROJECT: 0,
      OTHER: 0,
    };
    const incomeByReceivedThisMonth = {
      received: 0,
      pending: 0,
    };
    const salaryByScheduleThisMonth = {
      MONTHLY: 0,
      BI_WEEKLY: 0,
      ONE_OFF: 0,
    };

    for (const row of recordsThisMonth) {
      const a = Number(row.amount);
      const src = resolveSourceType(row);
      incomeBySourceThisMonth[src] += a;
      if (row.received) {
        incomeByReceivedThisMonth.received += a;
      } else {
        incomeByReceivedThisMonth.pending += a;
      }
      if (src === "SALARY") {
        const sched = resolveSalarySchedule(row);
        if (sched === "MONTHLY" || sched === "BI_WEEKLY" || sched === "ONE_OFF") {
          salaryByScheduleThisMonth[sched] += a;
        }
      }
    }

    const monthlyTrend: Array<{
      key: string;
      label: string;
      income: number;
      expense: number;
      debtPayments: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const incomeForMonth = incomeRecords
        .filter((r) =>
          isWithinInterval(r.scheduledDate, { start: ms, end: me }),
        )
        .reduce((s, r) => s + Number(r.amount), 0);
      monthlyTrend.push({
        key: format(ms, "yyyy-MM"),
        label: format(ms, "MMM yyyy"),
        income: incomeForMonth,
        expense: sumInMonth(expenses, ms, me),
        debtPayments: sumInMonth(debts, ms, me),
      });
    }

    const incomeForecastMonths: Array<{
      key: string;
      label: string;
      income: number;
    }> = [];
    const forecastStart = startOfMonth(now);
    for (let m = 0; m < 12; m++) {
      const d = addMonths(forecastStart, m);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      incomeForecastMonths.push({
        key: format(ms, "yyyy-MM"),
        label: format(ms, "MMM yy"),
        income: sumExpectedIncomeFromStreamsInMonth(incomeStreams, ms, me),
      });
    }

    const recentIncome = await ctx.prisma.income.findMany({
      where: { userId },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { tag: true, incomeStream: true },
    });

    const recentExpense = await ctx.prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      include: { tag: true },
    });

    return {
      totals: {
        totalIncome,
        totalExpense,
        totalDebtPayments,
        netLifetime,
      },
      thisMonth: {
        income: incomeThisMonth,
        expense: expenseThisMonth,
        debtPayments: debtPaymentsThisMonth,
        net: netThisMonth,
      },
      incomeBreakdownThisMonth: {
        bySource: incomeBySourceThisMonth,
        byReceived: incomeByReceivedThisMonth,
        salaryBySchedule: salaryByScheduleThisMonth,
      },
      monthlyTrend,
      incomeForecastMonths,
      recentIncome: recentIncome.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
      recentExpense: recentExpense.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
    };
  }),
});
