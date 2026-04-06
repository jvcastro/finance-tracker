"use client";

import * as React from "react";
import Link from "next/link";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendarMonth,
  IconCreditCard,
  IconPigMoney,
  IconScale,
  IconSettings,
  IconSparkles,
  IconTags,
} from "@tabler/icons-react";
import { format } from "date-fns";

import {
  CashFlowTrendChart,
  IncomeForecastChart,
  IncomeReceivedCard,
  IncomeSourceChart,
  SalaryPayScheduleCard,
  TagIncomeExpenseChart,
} from "@/components/dashboard/dashboard-charts";
import { RemindersCard } from "@/components/dashboard/reminders-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import {
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGET_LABEL,
  type DashboardWidgetsState,
} from "@/lib/dashboard-widgets";
import { formatDate } from "@/lib/format";
import { FINANCIAL_ACCOUNT_KIND_LABEL } from "@/lib/financial-account-kind";
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
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboard.summary.useQuery();
  const updateWidgets = trpc.dashboard.updateWidgets.useMutation({
    onSuccess: () => {
      void utils.dashboard.summary.invalidate();
      setCustomizeOpen(false);
    },
  });
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [widgetDraft, setWidgetDraft] = React.useState<DashboardWidgetsState | null>(
    null,
  );

  React.useEffect(() => {
    if (customizeOpen && data?.dashboardWidgets) {
      setWidgetDraft({ ...data.dashboardWidgets });
    }
  }, [customizeOpen, data?.dashboardWidgets]);

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
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
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
    needThisMonth,
    recentIncome,
    recentExpense,
    monthlyTrend,
    incomeForecastMonths,
    incomeBreakdownThisMonth,
    tagFlowThisMonth,
    reminders,
    dashboardWidgets: vis,
  } = data;
  const savingsRate =
    thisMonth.income > 0
      ? ((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100
      : 0;

  const outflows = thisMonth.expense;
  const burnPct =
    thisMonth.income > 0
      ? Math.min(100, (outflows / thisMonth.income) * 100)
      : 0;

  const monthName = new Date().toLocaleString(undefined, { month: "long" });
  const monthLabel = format(new Date(), "MMMM yyyy");

  return (
    <div className="flex flex-col gap-8">
      <section
        data-tour="dashboard-hero"
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.07] via-background to-chart-2/[0.06] px-5 py-6 sm:px-8 sm:py-8"
      >
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
                Cash flow, outlook, and recent activity.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 self-start"
              onClick={() => setCustomizeOpen(true)}
            >
              <IconSettings className="size-4" aria-hidden />
              Customize
            </Button>
          </div>

          {vis.overview ? (
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
                  Income minus expenses in {monthName}.
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
                <p className="text-muted-foreground mt-2 text-xs">For {monthName}.</p>
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
                <p className="text-muted-foreground mt-2 text-xs">For {monthName}.</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardDescription>Card spending</CardDescription>
                <IconCreditCard className="text-muted-foreground size-5 shrink-0" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {fmt(thisMonth.creditCardSpend)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Spending on expenses tied to a credit card account from Settings—not
                  the built-in &quot;Credit card&quot; tag.
                </p>
                {thisMonth.expense > 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {((thisMonth.creditCardSpend / thisMonth.expense) * 100).toFixed(0)}
                    % of this month&apos;s expenses.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
          ) : null}
        </div>
      </section>

      {vis.needThisMonth ? (
        <section>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Need this month</CardTitle>
              <CardDescription>
                Planned amounts for {monthLabel} from your income and expense entries. “Still
                to pay” and “Pending income” are based on Paid / Received flags.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Planned outflows
                </p>
                <p className="text-destructive mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.plannedOutflows)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  All expense rows dated this month.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Still to pay
                </p>
                <p className="text-destructive mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.stillToPay)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Expenses not marked paid yet.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Already paid
                </p>
                <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.alreadyPaid)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Expenses marked paid this month.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Expected income
                </p>
                <p className="text-chart-2 mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.expectedIncome)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  All income payments scheduled this month.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Pending income
                </p>
                <p className="text-amber-700 dark:text-amber-400 mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.pendingIncome)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Not marked received yet.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Received income
                </p>
                <p className="text-chart-2 mt-1 text-xl font-semibold tabular-nums">
                  {fmt(needThisMonth.receivedIncome)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Marked received this month.
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-4 sm:col-span-2 lg:col-span-3">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Liquidity gap (still to pay − pending income)
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    needThisMonth.residualCashGap > 0
                      ? "text-destructive"
                      : needThisMonth.residualCashGap < 0
                        ? "text-chart-2"
                        : "text-foreground"
                  }`}
                >
                  {fmt(needThisMonth.residualCashGap)}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Positive means you still need that much liquidity after expected inflows still
                  marked pending. Negative means pending income covers unpaid expenses.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {vis.reminders ? (
        <RemindersCard reminders={reminders} formatMoney={fmt} />
      ) : null}

      {vis.tagByTag ? (
      <section>
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconTags className="text-primary size-5 shrink-0" aria-hidden />
              Income and expenses by tag
            </CardTitle>
            <CardDescription>
              This month ({monthLabel}). Only tags with income or expense in this
              period are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TagIncomeExpenseChart
              data={tagFlowThisMonth}
              formatMoney={fmt}
              monthLabel={monthLabel}
            />
          </CardContent>
        </Card>
      </section>
      ) : null}

      {vis.incomeOutlook ? (
      <section>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCalendarMonth className="text-chart-2 size-5 shrink-0" aria-hidden />
                Income outlook
              </CardTitle>
              <CardDescription>
                Next 12 months from recurring income (planned amounts, not bank posting dates).
              </CardDescription>
            </div>
            <Link
              href="/income?tab=streams"
              className="text-primary shrink-0 text-sm font-medium underline-offset-4 hover:underline"
            >
              Recurring income
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <IncomeForecastChart data={incomeForecastMonths} formatMoney={fmt} />
          </CardContent>
        </Card>
      </section>
      ) : null}

      {vis.cashFlow ? (
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="border-border/80 xl:col-span-8 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Six-month cash flow</CardTitle>
            <CardDescription>
              Income, all expenses, and spending on credit card accounts by month.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <CashFlowTrendChart data={monthlyTrend} formatMoney={fmt} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Card className="border-border/80 flex-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Income by source</CardTitle>
              <CardDescription>
                Payment records this month, grouped by source type.
              </CardDescription>
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
      ) : null}

      {vis.insights ? (
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconPigMoney className="size-5 text-chart-2" aria-hidden />
              Savings rate
            </CardTitle>
            <CardDescription>Income after expenses (same month).</CardDescription>
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
            <CardDescription>Total expenses versus income this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total outflows</span>
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
              Share of income going to expenses ({burnPct.toFixed(0)}%).
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Lifetime totals</CardTitle>
            <CardDescription>
              Sums of every income and expense row (includes future scheduled income).
            </CardDescription>
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
              <span className="text-muted-foreground">Credit card accounts</span>
              <span className="font-medium tabular-nums">
                {fmt(totals.totalCreditCardSpend)}
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
      ) : null}

      {vis.recentLists ? (
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Recent income</CardTitle>
              <CardDescription>Most recent five payment records.</CardDescription>
            </div>
            <Link
              href="/income"
              className="text-primary shrink-0 text-sm font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentIncome.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No income yet.{" "}
                <Link
                  href="/income?tab=streams"
                  className="text-foreground font-medium underline underline-offset-2"
                >
                  Add recurring income
                </Link>{" "}
                or a manual payment.
              </p>
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
                        {row.financialAccount ? (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {row.financialAccount.name} ·{" "}
                            {FINANCIAL_ACCOUNT_KIND_LABEL[row.financialAccount.kind]}
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
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Recent expenses</CardTitle>
              <CardDescription>Most recent five expenses.</CardDescription>
            </div>
            <Link
              href="/expenses"
              className="text-primary shrink-0 text-sm font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-0">
            {recentExpense.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No expenses yet.{" "}
                <Link
                  href="/expenses"
                  className="text-foreground font-medium underline underline-offset-2"
                >
                  Add an expense
                </Link>
                .
              </p>
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
                    <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <time dateTime={new Date(row.date).toISOString()}>
                        {formatDate(row.date)}
                      </time>
                      {row.expenseStreamId ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Recurring
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          One-off
                        </Badge>
                      )}
                      {row.tag ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {row.tag.name}
                        </Badge>
                      ) : null}
                      {row.financialAccount ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {row.financialAccount.name} ·{" "}
                          {FINANCIAL_ACCOUNT_KIND_LABEL[row.financialAccount.kind]}
                        </Badge>
                      ) : null}
                    </div>
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
      ) : null}

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize dashboard</DialogTitle>
            <DialogDescription>
              Choose which sections appear. Your choices are saved to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {widgetDraft
              ? DASHBOARD_WIDGET_IDS.map((id) => (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox
                      id={`dw-${id}`}
                      checked={widgetDraft[id]}
                      onCheckedChange={(c) =>
                        setWidgetDraft((prev) =>
                          prev ? { ...prev, [id]: c === true } : prev,
                        )
                      }
                    />
                    <Label htmlFor={`dw-${id}`} className="cursor-pointer font-normal leading-snug">
                      {DASHBOARD_WIDGET_LABEL[id]}
                    </Label>
                  </div>
                ))
              : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomizeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!widgetDraft || updateWidgets.isPending}
              onClick={() => {
                if (!widgetDraft) return;
                updateWidgets.mutate(widgetDraft);
              }}
            >
              Save layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
