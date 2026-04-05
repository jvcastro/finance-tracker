"use client";

import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendarMonth,
  IconCreditCard,
  IconPigMoney,
  IconScale,
  IconSparkles,
} from "@tabler/icons-react";

import {
  CashFlowTrendChart,
  IncomeForecastChart,
  IncomeReceivedCard,
  IncomeSourceChart,
  SalaryPayScheduleCard,
} from "@/components/dashboard/dashboard-charts";
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

const SOURCE_BADGE: Record<
  "SALARY" | "PROJECT" | "OTHER",
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  SALARY: { label: "Salary", variant: "secondary" },
  PROJECT: { label: "Project", variant: "default" },
  OTHER: { label: "Other", variant: "outline" },
};

const SALARY_PAY_BADGE: Record<"MONTHLY" | "BI_WEEKLY" | "ONE_OFF", string> = {
  MONTHLY: "Monthly pay",
  BI_WEEKLY: "Bi-weekly",
  ONE_OFF: "One-off",
};

export function DashboardView() {
  const fmt = useCurrencyFormatter();
  const { data, isLoading } = trpc.dashboard.summary.useQuery();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-8">
        <div className="space-y-3">
          <Skeleton className="h-8 max-w-xs rounded-md" />
          <Skeleton className="h-4 max-w-lg rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid gap-4 xl:grid-cols-12">
          <Skeleton className="xl:col-span-8 h-80 rounded-xl" />
          <div className="xl:col-span-4 flex flex-col gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const {
    totals,
    thisMonth,
    recentIncome,
    recentExpense,
    monthlyTrend,
    incomeForecastMonths,
    incomeBreakdownThisMonth,
  } = data;
  const savingsRate =
    thisMonth.income > 0
      ? ((thisMonth.income - thisMonth.expense - thisMonth.debtPayments) /
          thisMonth.income) *
        100
      : 0;

  const outflows = thisMonth.expense + thisMonth.debtPayments;
  const burnPct =
    thisMonth.income > 0
      ? Math.min(100, (outflows / thisMonth.income) * 100)
      : 0;

  const monthName = new Date().toLocaleString(undefined, { month: "long" });

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.07] via-background to-chart-2/[0.06] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
                <IconSparkles className="size-3.5" aria-hidden />
                Overview
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                Cash flow, outlook, recent activity.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription>Net this month</CardDescription>
                <IconScale className="text-muted-foreground size-5 shrink-0" aria-hidden />
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    thisMonth.net >= 0 ? "text-foreground" : "text-destructive"
                  }`}
                >
                  {fmt(thisMonth.net)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  After expenses & card in {monthName}.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription>Income</CardDescription>
                <IconArrowUpRight className="text-chart-2 size-5 shrink-0" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-chart-2 text-2xl font-semibold tabular-nums">
                  {fmt(thisMonth.income)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">In {monthName}.</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription>Expenses</CardDescription>
                <IconArrowDownRight className="text-destructive size-5 shrink-0" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-destructive text-2xl font-semibold tabular-nums">
                  {fmt(thisMonth.expense)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">This month.</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription>Card payments</CardDescription>
                <IconCreditCard className="text-muted-foreground size-5 shrink-0" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {fmt(thisMonth.debtPayments)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">From Expenses → Card.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconCalendarMonth className="text-chart-2 size-5" aria-hidden />
              Income outlook
            </CardTitle>
            <CardDescription>
              Next 12 months from recurring streams (plan, not bank timing).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <IncomeForecastChart data={incomeForecastMonths} formatMoney={fmt} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="border-border/80 xl:col-span-8 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Six-month cash flow</CardTitle>
            <CardDescription>Income vs spend vs card by month.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CashFlowTrendChart data={monthlyTrend} formatMoney={fmt} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Card className="border-border/80 flex-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Income by source</CardTitle>
              <CardDescription>This month by source.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <IncomeSourceChart
                bySource={incomeBreakdownThisMonth.bySource}
                formatMoney={fmt}
              />
            </CardContent>
          </Card>
          <IncomeReceivedCard
            byReceived={incomeBreakdownThisMonth.byReceived}
            totalIncome={thisMonth.income}
            formatMoney={fmt}
          />
          <SalaryPayScheduleCard
            salaryBySchedule={incomeBreakdownThisMonth.salaryBySchedule}
            formatMoney={fmt}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconPigMoney className="size-5 text-chart-2" aria-hidden />
              Savings rate
            </CardTitle>
            <CardDescription>Income left after spend & card.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {pct(savingsRate)}
            </p>
            <p className="text-muted-foreground mt-3 text-xs">Not financial advice.</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Outflow load</CardTitle>
            <CardDescription>Outflows vs income.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total out</span>
              <span className="tabular-nums font-medium">{fmt(outflows)}</span>
            </div>
            <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
              <div
                className="from-primary to-chart-4 bg-gradient-to-r h-full rounded-full transition-all duration-500"
                style={{
                  width: `${burnPct}%`,
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Share of income to spend + card ({burnPct.toFixed(0)}%).
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Lifetime totals</CardTitle>
            <CardDescription>All-time totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Income</span>
              <span className="text-chart-2 font-medium tabular-nums">
                {fmt(totals.totalIncome)}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Expenses</span>
              <span className="text-destructive font-medium tabular-nums">
                {fmt(totals.totalExpense)}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Card payments</span>
              <span className="font-medium tabular-nums">
                {fmt(totals.totalDebtPayments)}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-1">
              <span className="font-medium">Net (lifetime)</span>
              <span
                className={`font-semibold tabular-nums ${
                  totals.netLifetime >= 0 ? "" : "text-destructive"
                }`}
              >
                {fmt(totals.netLifetime)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent income</CardTitle>
            <CardDescription>Last five.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentIncome.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No income yet.</p>
            ) : (
              recentIncome.map((row) => {
                const sourceType =
                  (row.incomeStream?.sourceType ?? row.sourceType ?? "OTHER") as
                    | "SALARY"
                    | "PROJECT"
                    | "OTHER";
                const title =
                  row.incomeStream?.sourceName?.trim() ||
                  row.sourceName?.trim() ||
                  row.description ||
                  "Income";
                const sched =
                  row.incomeStream?.salaryPaySchedule ?? row.salaryPaySchedule;
                return (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-snug">{title}</p>
                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span>{formatDate(row.scheduledDate)}</span>
                        <Badge variant={SOURCE_BADGE[sourceType].variant} className="text-[10px]">
                          {SOURCE_BADGE[sourceType].label}
                        </Badge>
                        {sourceType === "SALARY" && sched ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {SALARY_PAY_BADGE[sched]}
                          </Badge>
                        ) : null}
                        <Badge
                          variant={row.received ? "secondary" : "outline"}
                          className="text-[10px] font-normal"
                        >
                          {row.received ? "Received" : "Pending"}
                        </Badge>
                        {row.incomeStreamId ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Recurring
                          </Badge>
                        ) : null}
                        {row.tag ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {row.tag.name}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-chart-2 shrink-0 text-sm font-semibold tabular-nums">
                      {fmt(row.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent expenses</CardTitle>
            <CardDescription>Last five.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentExpense.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No expenses yet.</p>
            ) : (
              recentExpense.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 border-b border-border/50 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-snug">
                      {row.description || "Expense"}
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      <time dateTime={new Date(row.date).toISOString()}>
                        {formatDate(row.date)}
                      </time>
                      {row.tag ? (
                        <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                          {row.tag.name}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-destructive shrink-0 text-sm font-semibold tabular-nums">
                    {fmt(row.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
