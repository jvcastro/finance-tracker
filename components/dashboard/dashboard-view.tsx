"use client";

import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCreditCard,
  IconPigMoney,
  IconScale,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function DashboardView() {
  const fmt = useCurrencyFormatter();
  const { data, isLoading } = trpc.dashboard.summary.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  const { totals, thisMonth, recentIncome, recentExpense } = data;
  const savingsRate =
    thisMonth.income > 0
      ? ((thisMonth.income - thisMonth.expense - thisMonth.debtPayments) /
          thisMonth.income) *
        100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Snapshot of cash flow, debt payments, and recent activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardDescription>Net this month</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {fmt(thisMonth.net)}
              </CardTitle>
            </div>
            <IconScale className="text-muted-foreground size-5" />
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Income minus expenses and card payments in the current calendar month.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardDescription>Income (month)</CardDescription>
              <CardTitle className="text-chart-2 text-xl tabular-nums">
                {fmt(thisMonth.income)}
              </CardTitle>
            </div>
            <IconArrowUpRight className="text-chart-2 size-5" />
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Recorded inflows for {new Date().toLocaleString(undefined, { month: "long" })}.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardDescription>Expenses (month)</CardDescription>
              <CardTitle className="text-destructive text-xl tabular-nums">
                {fmt(thisMonth.expense)}
              </CardTitle>
            </div>
            <IconArrowDownRight className="text-destructive size-5" />
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Regular spending tracked this month.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardDescription>Card payments (month)</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {fmt(thisMonth.debtPayments)}
              </CardTitle>
            </div>
            <IconCreditCard className="text-muted-foreground size-5" />
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            Credit card transfers or pay-downs logged on the Expenses page.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Lifetime overview</CardTitle>
            <CardDescription>All-time totals in your local database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total income</span>
              <span className="text-chart-2 font-medium tabular-nums">
                {fmt(totals.totalIncome)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total expenses</span>
              <span className="text-destructive font-medium tabular-nums">
                {fmt(totals.totalExpense)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Card payments</span>
              <span className="font-medium tabular-nums">
                {fmt(totals.totalDebtPayments)}
              </span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium">Net (lifetime)</span>
                <span className="font-semibold tabular-nums">{fmt(totals.netLifetime)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconPigMoney className="size-5" />
              Savings rate
            </CardTitle>
            <CardDescription>
              Rough share of this month&apos;s income left after spending and card payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{pct(savingsRate)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Not investment advice—just a quick ratio from your entries.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Budget pulse</CardTitle>
            <CardDescription>
              Expenses + card payments vs income this month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outflows</span>
              <span className="tabular-nums">
                {fmt(thisMonth.expense + thisMonth.debtPayments)}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    thisMonth.income > 0
                      ? ((thisMonth.expense + thisMonth.debtPayments) /
                          thisMonth.income) *
                          100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Bar shows share of monthly income consumed by expenses plus card payments.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent income</CardTitle>
            <CardDescription>Latest five entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentIncome.length === 0 ? (
              <p className="text-muted-foreground text-sm">No income yet.</p>
            ) : (
              recentIncome.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.description || "Income"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(row.date)}
                      {row.tag ? (
                        <Badge variant="secondary" className="ml-2 align-middle">
                          {row.tag.name}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-chart-2 shrink-0 text-sm font-medium tabular-nums">
                    {fmt(row.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent expenses</CardTitle>
            <CardDescription>Latest five entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentExpense.length === 0 ? (
              <p className="text-muted-foreground text-sm">No expenses yet.</p>
            ) : (
              recentExpense.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.description || "Expense"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(row.date)}
                      {row.tag ? (
                        <Badge variant="secondary" className="ml-2 align-middle">
                          {row.tag.name}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-destructive shrink-0 text-sm font-medium tabular-nums">
                    {fmt(row.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
