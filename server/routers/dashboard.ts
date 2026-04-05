import { startOfMonth, endOfMonth } from "date-fns";

import { router, protectedProcedure } from "@/server/trpc";

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [incomes, expenses, debts, incomeMonth, expenseMonth, debtMonth] =
      await Promise.all([
        ctx.prisma.income.findMany({ where: { userId } }),
        ctx.prisma.expense.findMany({ where: { userId } }),
        ctx.prisma.creditCardDebt.findMany({ where: { userId } }),
        ctx.prisma.income.findMany({
          where: {
            userId,
            date: { gte: monthStart, lte: monthEnd },
          },
        }),
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

    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalDebtPayments = debts.reduce((s, d) => s + Number(d.amount), 0);

    const incomeThisMonth = incomeMonth.reduce(
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

    const recentIncome = await ctx.prisma.income.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 5,
      include: { tag: true },
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
