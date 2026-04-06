"use client";

import Link from "next/link";
import { IconAlertTriangle, IconBell, IconChevronRight } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ReminderIncome = {
  id: string;
  scheduledDate: Date;
  amount: number;
  title: string;
  daysOverdue: number;
};

type ReminderExpense = {
  id: string;
  date: Date;
  amount: number;
  title: string;
  daysOverdue: number;
};

type DueSoonIncome = {
  id: string;
  scheduledDate: Date;
  amount: number;
  title: string;
  daysUntil: number;
};

type DueSoonExpense = {
  id: string;
  date: Date;
  amount: number;
  title: string;
  daysUntil: number;
};

export type RemindersPayload = {
  overdueIncome: ReminderIncome[];
  overdueExpenses: ReminderExpense[];
  dueSoonIncome: DueSoonIncome[];
  dueSoonExpenses: DueSoonExpense[];
};

function dueLabel(daysUntil: number) {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export function RemindersCard({
  reminders,
  formatMoney,
}: {
  reminders: RemindersPayload;
  formatMoney: (n: number) => string;
}) {
  const {
    overdueIncome,
    overdueExpenses,
    dueSoonIncome,
    dueSoonExpenses,
  } = reminders;

  const hasOverdue =
    overdueIncome.length > 0 || overdueExpenses.length > 0;
  const hasDueSoon =
    dueSoonIncome.length > 0 || dueSoonExpenses.length > 0;

  if (!hasOverdue && !hasDueSoon) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconBell className="text-muted-foreground size-5 shrink-0" aria-hidden />
            Reminders
          </CardTitle>
          <CardDescription>
            No pending income or unpaid expenses are overdue, and nothing is due in the next 7
            days.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-border/80 shadow-sm",
        hasOverdue &&
          "border-amber-500/40 bg-amber-500/[0.06] dark:border-amber-400/30 dark:bg-amber-500/[0.08]",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {hasOverdue ? (
            <IconAlertTriangle
              className="size-5 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden
            />
          ) : (
            <IconBell className="text-muted-foreground size-5 shrink-0" aria-hidden />
          )}
          Reminders
          {hasOverdue ? (
            <Badge
              variant="outline"
              className="border-amber-600/50 font-normal text-amber-900 dark:border-amber-400/50 dark:text-amber-200"
            >
              Action needed
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {hasOverdue
            ? "Past scheduled dates still pending. Mark received or paid when done."
            : "Upcoming due dates in the next 7 days."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {hasOverdue ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
              Overdue
            </p>
            {overdueIncome.length > 0 ? (
              <ul className="space-y-2">
                {overdueIncome.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-amber-500/25 bg-background/80 px-3 py-2 text-sm dark:border-amber-400/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Income · {formatDate(r.scheduledDate)} ·{" "}
                        <span className="text-amber-800 dark:text-amber-300">
                          {r.daysOverdue === 1
                            ? "1 day overdue"
                            : `${r.daysOverdue} days overdue`}
                        </span>
                      </p>
                    </div>
                    <span className="text-chart-2 shrink-0 font-semibold tabular-nums">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {overdueExpenses.length > 0 ? (
              <ul className="space-y-2">
                {overdueExpenses.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-amber-500/25 bg-background/80 px-3 py-2 text-sm dark:border-amber-400/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Expense · {formatDate(r.date)} ·{" "}
                        <span className="text-amber-800 dark:text-amber-300">
                          {r.daysOverdue === 1
                            ? "1 day overdue"
                            : `${r.daysOverdue} days overdue`}
                        </span>
                      </p>
                    </div>
                    <span className="text-destructive shrink-0 font-semibold tabular-nums">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/income"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
              >
                Open income
                <IconChevronRight className="size-3.5" aria-hidden />
              </Link>
              <Link
                href="/expenses"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
              >
                Open expenses
                <IconChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        ) : null}

        {hasDueSoon ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Due in the next 7 days
            </p>
            {dueSoonIncome.length > 0 ? (
              <ul className="space-y-2">
                {dueSoonIncome.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Income · {formatDate(r.scheduledDate)} · {dueLabel(r.daysUntil)}
                      </p>
                    </div>
                    <span className="text-chart-2 shrink-0 font-semibold tabular-nums">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {dueSoonExpenses.length > 0 ? (
              <ul className="space-y-2">
                {dueSoonExpenses.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Expense · {formatDate(r.date)} · {dueLabel(r.daysUntil)}
                      </p>
                    </div>
                    <span className="text-destructive shrink-0 font-semibold tabular-nums">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {!hasOverdue ? (
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/income"
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                >
                  Open income
                  <IconChevronRight className="size-3.5" aria-hidden />
                </Link>
                <Link
                  href="/expenses"
                  className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                >
                  Open expenses
                  <IconChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
