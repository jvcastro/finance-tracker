import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";

import { Prisma } from "@/generated/prisma/client";
import {
  mergeDashboardWidgetPatch,
  parseDashboardWidgets,
} from "@/lib/dashboard-widgets";
import { CREDIT_CARD_TAG_NAME } from "@/lib/default-tags";
import { ensureExpenseRecordsRollingWindow } from "@/lib/expense-ensure";
import { ensureIncomeRecordsRollingWindow } from "@/lib/income-ensure";
import { sumExpectedIncomeFromStreamsInMonth } from "@/lib/income-schedule";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

const dashboardWidgetsPatchSchema = z
  .object({
    overview: z.boolean().optional(),
    needThisMonth: z.boolean().optional(),
    reminders: z.boolean().optional(),
    tagByTag: z.boolean().optional(),
    incomeOutlook: z.boolean().optional(),
    cashFlow: z.boolean().optional(),
    insights: z.boolean().optional(),
    recentLists: z.boolean().optional(),
  })
  .strict();

/** Aggregates + trends: only fields used by resolveSourceType / reminder titles. */
const incomeRecordsForTotalsSelect = {
  id: true,
  amount: true,
  scheduledDate: true,
  received: true,
  sourceType: true,
  salaryPaySchedule: true,
  sourceName: true,
  description: true,
  incomeStreamId: true,
  tagId: true,
  tag: { select: { id: true, name: true, color: true } },
  incomeStream: {
    select: {
      sourceType: true,
      salaryPaySchedule: true,
      sourceName: true,
    },
  },
} satisfies Prisma.IncomeSelect;

const expenseWithTagSelect = {
  id: true,
  date: true,
  amount: true,
  paid: true,
  tagId: true,
  tag: { select: { id: true, name: true, color: true } },
} satisfies Prisma.ExpenseSelect;

const dashboardRecentIncomeSelect = {
  id: true,
  incomeStreamId: true,
  scheduledDate: true,
  amount: true,
  received: true,
  description: true,
  sourceType: true,
  sourceName: true,
  salaryPaySchedule: true,
  tag: { select: { name: true } },
  financialAccount: { select: { name: true, kind: true } },
  incomeStream: {
    select: {
      sourceType: true,
      sourceName: true,
      salaryPaySchedule: true,
    },
  },
} satisfies Prisma.IncomeSelect;

const dashboardRecentExpenseSelect = {
  id: true,
  date: true,
  amount: true,
  description: true,
  expenseStreamId: true,
  tag: { select: { name: true } },
  financialAccount: { select: { name: true, kind: true } },
} satisfies Prisma.ExpenseSelect;

const incomeReminderRowSelect = {
  id: true,
  scheduledDate: true,
  amount: true,
  description: true,
  sourceName: true,
  incomeStream: { select: { sourceName: true } },
} satisfies Prisma.IncomeSelect;

const expenseReminderRowSelect = {
  id: true,
  date: true,
  amount: true,
  description: true,
} satisfies Prisma.ExpenseSelect;

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

function incomeReminderTitle(r: {
  description: string | null;
  sourceName: string | null;
  incomeStream: { sourceName: string | null } | null;
}) {
  const fromStream = r.incomeStream?.sourceName?.trim();
  const manual = r.sourceName?.trim();
  if (fromStream) return fromStream;
  if (manual) return manual;
  return r.description?.trim() || "Income";
}

/** Sum of expenses with the default “Credit card” tag (not a second ledger). */
function sumCreditCardTaggedExpensesInRange(
  rows: Array<{ date: Date; amount: unknown; tag: { name: string } | null }>,
  range: { start: Date; end: Date },
) {
  return rows.reduce((s, r) => {
    if (r.tag?.name !== CREDIT_CARD_TAG_NAME) return s;
    if (!isWithinInterval(r.date, range)) return s;
    return s + Number(r.amount);
  }, 0);
}

function sumCreditCardTaggedExpensesAllTime(
  rows: Array<{ amount: unknown; tag: { name: string } | null }>,
) {
  return rows.reduce((s, r) => {
    if (r.tag?.name !== CREDIT_CARD_TAG_NAME) return s;
    return s + Number(r.amount);
  }, 0);
}

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    await ensureIncomeRecordsRollingWindow(ctx.prisma, userId);
    await ensureExpenseRecordsRollingWindow(ctx.prisma, userId);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [incomeRecords, incomeStreams, expenses, appSettingsRow] =
      await Promise.all([
        ctx.prisma.income.findMany({
          where: { userId },
          select: incomeRecordsForTotalsSelect,
        }),
        ctx.prisma.incomeStream.findMany({ where: { userId, isActive: true } }),
        ctx.prisma.expense.findMany({
          where: { userId },
          select: expenseWithTagSelect,
        }),
        ctx.prisma.appSettings.findUnique({ where: { userId } }),
      ]);

    const recordsThisMonth = incomeRecords.filter((r) =>
      isWithinInterval(r.scheduledDate, { start: monthStart, end: monthEnd }),
    );

    const totalIncome = incomeRecords.reduce((s, i) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalDebtPayments = sumCreditCardTaggedExpensesAllTime(expenses);

    const incomeThisMonth = recordsThisMonth.reduce(
      (s, i) => s + Number(i.amount),
      0,
    );
    const expenseThisMonthRows = expenses.filter((e) =>
      isWithinInterval(e.date, { start: monthStart, end: monthEnd }),
    );
    const expenseThisMonth = expenseThisMonthRows.reduce(
      (s, e) => s + Number(e.amount),
      0,
    );
    let stillToPayExpenses = 0;
    let alreadyPaidExpenses = 0;
    for (const e of expenseThisMonthRows) {
      const a = Number(e.amount);
      if (e.paid) alreadyPaidExpenses += a;
      else stillToPayExpenses += a;
    }
    const debtPaymentsThisMonth = sumCreditCardTaggedExpensesInRange(
      expenses,
      { start: monthStart, end: monthEnd },
    );

    const netLifetime = totalIncome - totalExpense;
    const netThisMonth = incomeThisMonth - expenseThisMonth;

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

    /** Unpaid expenses still to settle minus income not yet received (liquidity gap). */
    const residualCashGap =
      stillToPayExpenses - incomeByReceivedThisMonth.pending;

    const UNTAGGED_KEY = "__untagged__";

    const tagFlowMap = new Map<
      string,
      {
        tagId: string;
        name: string;
        color: string | null;
        income: number;
        expense: number;
      }
    >();

    function ensureTagRow(
      key: string,
      tagId: string,
      name: string,
      color: string | null,
    ) {
      if (!tagFlowMap.has(key)) {
        tagFlowMap.set(key, {
          tagId,
          name,
          color,
          income: 0,
          expense: 0,
        });
      }
      return tagFlowMap.get(key)!;
    }

    for (const row of recordsThisMonth) {
      const a = Number(row.amount);
      const key = row.tag && row.tagId ? row.tag.id : UNTAGGED_KEY;
      const name = row.tag?.name ?? "Untagged";
      const color = row.tag?.color ?? null;
      const id = row.tag?.id ?? "";
      ensureTagRow(key, id, name, color).income += a;
    }

    for (const row of expenseThisMonthRows) {
      const a = Number(row.amount);
      const key = row.tag && row.tagId ? row.tag.id : UNTAGGED_KEY;
      const name = row.tag?.name ?? "Untagged";
      const color = row.tag?.color ?? null;
      const id = row.tag?.id ?? "";
      ensureTagRow(key, id, name, color).expense += a;
    }

    const tagFlowThisMonth = Array.from(tagFlowMap.values())
      .filter((x) => x.income > 0 || x.expense > 0)
      .sort((a, b) => {
        const vol = b.income + b.expense - (a.income + a.expense);
        if (vol !== 0) return vol;
        return a.name.localeCompare(b.name);
      });

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
        debtPayments: sumCreditCardTaggedExpensesInRange(expenses, {
          start: ms,
          end: me,
        }),
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
      select: dashboardRecentIncomeSelect,
    });

    const recentExpense = await ctx.prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      select: dashboardRecentExpenseSelect,
    });

    const todayStart = startOfDay(now);
    const weekEnd = endOfDay(addDays(now, 7));

    const [
      overdueIncomeRows,
      overdueExpenseRows,
      dueSoonIncomeRows,
      dueSoonExpenseRows,
    ] = await Promise.all([
      ctx.prisma.income.findMany({
        where: {
          userId,
          received: false,
          scheduledDate: { lt: todayStart },
        },
        orderBy: { scheduledDate: "asc" },
        take: 25,
        select: incomeReminderRowSelect,
      }),
      ctx.prisma.expense.findMany({
        where: {
          userId,
          paid: false,
          date: { lt: todayStart },
        },
        orderBy: { date: "asc" },
        take: 25,
        select: expenseReminderRowSelect,
      }),
      ctx.prisma.income.findMany({
        where: {
          userId,
          received: false,
          scheduledDate: { gte: todayStart, lte: weekEnd },
        },
        orderBy: { scheduledDate: "asc" },
        take: 15,
        select: incomeReminderRowSelect,
      }),
      ctx.prisma.expense.findMany({
        where: {
          userId,
          paid: false,
          date: { gte: todayStart, lte: weekEnd },
        },
        orderBy: { date: "asc" },
        take: 15,
        select: expenseReminderRowSelect,
      }),
    ]);

    const overdueIncome = overdueIncomeRows.map((r) => ({
      id: r.id,
      scheduledDate: r.scheduledDate,
      amount: Number(r.amount),
      title: incomeReminderTitle(r),
      daysOverdue: differenceInCalendarDays(todayStart, startOfDay(r.scheduledDate)),
    }));

    const overdueExpenses = overdueExpenseRows.map((r) => ({
      id: r.id,
      date: r.date,
      amount: Number(r.amount),
      title: r.description?.trim() || "Expense",
      daysOverdue: differenceInCalendarDays(todayStart, startOfDay(r.date)),
    }));

    const dueSoonIncome = dueSoonIncomeRows.map((r) => ({
      id: r.id,
      scheduledDate: r.scheduledDate,
      amount: Number(r.amount),
      title: incomeReminderTitle(r),
      daysUntil: differenceInCalendarDays(
        startOfDay(r.scheduledDate),
        todayStart,
      ),
    }));

    const dueSoonExpenses = dueSoonExpenseRows.map((r) => ({
      id: r.id,
      date: r.date,
      amount: Number(r.amount),
      title: r.description?.trim() || "Expense",
      daysUntil: differenceInCalendarDays(startOfDay(r.date), todayStart),
    }));

    const dashboardWidgets = parseDashboardWidgets(appSettingsRow?.dashboardWidgets);

    return {
      dashboardWidgets,
      needThisMonth: {
        plannedOutflows: expenseThisMonth,
        stillToPay: stillToPayExpenses,
        alreadyPaid: alreadyPaidExpenses,
        expectedIncome: incomeThisMonth,
        pendingIncome: incomeByReceivedThisMonth.pending,
        receivedIncome: incomeByReceivedThisMonth.received,
        residualCashGap,
      },
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
      tagFlowThisMonth,
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
      reminders: {
        overdueIncome,
        overdueExpenses,
        dueSoonIncome,
        dueSoonExpenses,
      },
    };
  }),

  updateWidgets: protectedProcedure
    .input(dashboardWidgetsPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const existing = await ctx.prisma.appSettings.findUnique({
        where: { userId },
      });
      const merged = mergeDashboardWidgetPatch(
        existing?.dashboardWidgets,
        input,
      );
      await ctx.prisma.appSettings.upsert({
        where: { userId },
        create: {
          userId,
          currency: existing?.currency ?? "PHP",
          weekStartsOn: existing?.weekStartsOn ?? 0,
          dashboardWidgets: merged as object,
        },
        update: { dashboardWidgets: merged as object },
      });
      return merged;
    }),
});
