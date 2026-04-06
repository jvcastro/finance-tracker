"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TrendPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  creditCardSpend: number;
};

type SourceKey = "SALARY" | "PROJECT" | "OTHER";

const SOURCE_META: Record<
  SourceKey,
  { label: string; colorVar: string }
> = {
  SALARY: { label: "Salary", colorVar: "var(--chart-2)" },
  PROJECT: { label: "Project", colorVar: "var(--chart-3)" },
  OTHER: { label: "Other", colorVar: "var(--chart-4)" },
};

function tickShort(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function CashFlowTrendChart({
  data,
  formatMoney,
}: {
  data: TrendPoint[];
  formatMoney: (n: number) => string;
}) {
  return (
    <div
      className="h-[min(22rem,50vh)] w-full min-h-[220px]"
      role="img"
      aria-label="Cash flow over the last six months: income, all expenses, and credit card account spending"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="18%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/80"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={tickShort}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground mb-1.5 font-medium">{label}</p>
                  <ul className="space-y-1">
                    {payload.map((p) => (
                      <li key={String(p.dataKey)} className="flex justify-between gap-6">
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="font-medium tabular-nums">
                          {formatMoney(Number(p.value))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (
              <span className="text-muted-foreground">{value}</span>
            )}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill="var(--destructive)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="creditCardSpend"
            name="Card accounts"
            fill="var(--chart-5)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type ForecastPoint = {
  key: string;
  label: string;
  income: number;
};

export function IncomeForecastChart({
  data,
  formatMoney,
}: {
  data: ForecastPoint[];
  formatMoney: (n: number) => string;
}) {
  const hasAny = data.some((d) => d.income > 0);

  if (!hasAny) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Add recurring income on the{" "}
        <Link
          href="/income?tab=streams"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Income
        </Link>{" "}
        page (Recurring tab) to see this chart.
      </p>
    );
  }

  return (
    <div
      className="h-[min(20rem,45vh)] w-full min-h-[200px]"
      role="img"
      aria-label="Projected income for the next twelve calendar months"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 44 }}
          barCategoryGap="10%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/80"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            angle={-38}
            textAnchor="end"
            height={44}
            interval={0}
          />
          <YAxis
            tickFormatter={tickShort}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            width={44}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground mb-1 font-medium">{label}</p>
                  <p className="text-chart-2 font-semibold tabular-nums">
                    {formatMoney(Number(payload[0].value))}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    Recurring income active in that month.
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="income"
            name="Projected"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type TagFlowRow = {
  tagId: string;
  name: string;
  color: string | null;
  income: number;
  expense: number;
};

export function TagIncomeExpenseChart({
  data,
  formatMoney,
  monthLabel,
}: {
  data: TagFlowRow[];
  formatMoney: (n: number) => string;
  monthLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Tag income and expenses when you add or edit entries. Only tags with
        activity this month appear here.
      </p>
    );
  }

  const chartData = data.map((t) => ({
    name:
      t.name.length > 20 ? `${t.name.slice(0, 18).trim()}…` : t.name,
    fullName: t.name,
    income: t.income,
    expense: t.expense,
    tagColor: t.color,
  }));

  const chartHeight = Math.min(520, Math.max(200, chartData.length * 40 + 48));

  return (
    <div
      className="w-full"
      style={{ height: chartHeight }}
      role="img"
      aria-label={`Income and expenses by tag for ${monthLabel}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          barCategoryGap="12%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border/80"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={tickShort}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.25 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as {
                fullName: string;
                tagColor: string | null;
              };
              return (
                <div className="bg-popover text-popover-foreground max-w-xs rounded-lg border px-3 py-2 text-xs shadow-md">
                  <p className="mb-1.5 flex items-center gap-2 font-medium">
                    {row.tagColor ? (
                      <span
                        className="size-2.5 shrink-0 rounded-full border"
                        style={{ backgroundColor: row.tagColor }}
                        aria-hidden
                      />
                    ) : null}
                    <span>{row.fullName}</span>
                  </p>
                  <ul className="space-y-1">
                    {payload.map((p) => (
                      <li
                        key={String(p.dataKey)}
                        className="flex justify-between gap-6"
                      >
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="font-medium tabular-nums">
                          {formatMoney(Number(p.value))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (
              <span className="text-muted-foreground">{value}</span>
            )}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--chart-2)"
            radius={[0, 2, 2, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill="var(--destructive)"
            radius={[0, 2, 2, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeSourceChart({
  bySource,
  formatMoney,
}: {
  bySource: Record<SourceKey, number>;
  formatMoney: (n: number) => string;
}) {
  const pieData = (["SALARY", "PROJECT", "OTHER"] as const).map((key) => ({
    name: SOURCE_META[key].label,
    value: bySource[key],
    fill: SOURCE_META[key].colorVar,
  }));
  const total = pieData.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No income payment records this month.
      </p>
    );
  }

  return (
    <div
      className="h-[220px] w-full"
      role="img"
      aria-label="This month’s income split by salary, project, and other sources"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={3}
            stroke="var(--border)"
            strokeWidth={1}
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const p = payload[0].payload as {
                name: string;
                value: number;
                fill: string;
              };
              const pct = total > 0 ? (p.value / total) * 100 : 0;
              return (
                <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground tabular-nums">
                    {formatMoney(p.value)} ({pct.toFixed(0)}%)
                  </p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            formatter={(value) => (
              <span className="text-muted-foreground text-xs">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeReceivedCard({
  byReceived,
  totalIncome,
  formatMoney,
}: {
  byReceived: { received: number; pending: number };
  totalIncome: number;
  formatMoney: (n: number) => string;
}) {
  const received = byReceived.received;
  const pending = byReceived.pending;
  const pctReceived =
    totalIncome > 0 ? Math.round((received / totalIncome) * 100) : 0;
  const pctPending =
    totalIncome > 0 ? Math.round((pending / totalIncome) * 100) : 0;

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Received and pending</CardTitle>
        <CardDescription>Deposited versus still expected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalIncome <= 0 ? (
          <p className="text-muted-foreground text-sm">No income recorded this month.</p>
        ) : (
          <>
            <div className="bg-muted flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-chart-2 transition-all"
                style={{ width: `${pctReceived}%` }}
                title={`Received ${pctReceived}%`}
              />
              <div
                className="bg-amber-500/80 transition-all dark:bg-amber-400/70"
                style={{ width: `${pctPending}%` }}
                title={`Pending ${pctPending}%`}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-2 size-2 rounded-sm" />
                <span className="text-muted-foreground">Received</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(received)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-amber-500 size-2 rounded-sm dark:bg-amber-400" />
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(pending)}
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SalaryPayScheduleCard({
  salaryBySchedule,
  formatMoney,
}: {
  salaryBySchedule: {
    MONTHLY: number;
    BI_WEEKLY: number;
    ONE_OFF: number;
  };
  formatMoney: (n: number) => string;
}) {
  const total =
    salaryBySchedule.MONTHLY +
    salaryBySchedule.BI_WEEKLY +
    salaryBySchedule.ONE_OFF;

  const segments = [
    {
      key: "MONTHLY" as const,
      label: "Monthly pay",
      amount: salaryBySchedule.MONTHLY,
      swatch: "bg-chart-2",
    },
    {
      key: "BI_WEEKLY" as const,
      label: "Bi-weekly pay",
      amount: salaryBySchedule.BI_WEEKLY,
      swatch: "bg-chart-3",
    },
    {
      key: "ONE_OFF" as const,
      label: "One-off",
      amount: salaryBySchedule.ONE_OFF,
      swatch: "bg-chart-5",
    },
  ];

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Salary pay schedule</CardTitle>
        <CardDescription>Salary by pay schedule.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {total <= 0 ? (
          <p className="text-muted-foreground text-sm">
            No salary income recorded this month.
          </p>
        ) : (
          <>
            <div className="bg-muted flex h-3 overflow-hidden rounded-full">
              {segments.map((s) => {
                const w = total > 0 ? Math.round((s.amount / total) * 100) : 0;
                return (
                  <div
                    key={s.key}
                    className={`${s.swatch} transition-all`}
                    style={{ width: `${w}%` }}
                    title={`${s.label} ${w}%`}
                  />
                );
              })}
            </div>
            <ul className="flex flex-col gap-2 text-xs">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className={`${s.swatch} size-2 shrink-0 rounded-sm`} />
                    {s.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
