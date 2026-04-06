"use client";

import * as React from "react";
import { zodResolver } from "@/lib/zod-resolver";
import {
  IconCalendarMonth,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { type ColumnDef } from "@tanstack/react-table";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { z } from "zod";

import {
  DataTable,
  filterRowsByGlobalFilter,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { formatDate, formatIncomePeriod } from "@/lib/format";
import {
  FINANCIAL_ACCOUNT_KIND_LABEL,
  type FinancialAccountKindValue,
} from "@/lib/financial-account-kind";
import { trpc } from "@/lib/trpc/react";

type FinancialAccountRef = {
  id: string;
  name: string;
  kind: FinancialAccountKindValue;
};

const PAYMENT_METHOD_LABEL = {
  MANUAL: "Manual / other",
  BANK_AUTO_DEBIT: "Bank auto debit",
  CARD_AUTO_PAY: "Card auto-pay",
} as const;

const expenseSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
  tagId: z.string().optional(),
  financialAccountId: z.string().optional(),
  paymentMethod: z.enum(["MANUAL", "BANK_AUTO_DEBIT", "CARD_AUTO_PAY"]),
  paid: z.boolean(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

type ExpenseRow = {
  id: string;
  amount: number;
  date: Date;
  description: string | null;
  tagId: string | null;
  tag: { id: string; name: string } | null;
  financialAccountId: string | null;
  financialAccount: FinancialAccountRef | null;
  paymentMethod: keyof typeof PAYMENT_METHOD_LABEL;
  expenseStreamId: string | null;
  expenseStream: { id: string } | null;
  paid: boolean;
};

const expenseStreamSchema = z
  .object({
    amount: z.coerce.number().positive(),
    description: z.string().optional(),
    tagId: z.string().optional(),
    financialAccountId: z.string().optional(),
    paymentMethod: z.enum(["MANUAL", "BANK_AUTO_DEBIT", "CARD_AUTO_PAY"]),
    paymentDay: z.coerce.number().int().min(1).max(31),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate?.trim()) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      if (e < s) {
        ctx.addIssue({
          code: "custom",
          message: "End date must be on or after the start date.",
          path: ["endDate"],
        });
      }
    }
  });

type ExpenseStreamForm = z.infer<typeof expenseStreamSchema>;

type ExpenseStreamRow = {
  id: string;
  amount: number;
  description: string | null;
  tagId: string | null;
  tag: { id: string; name: string } | null;
  financialAccountId: string | null;
  financialAccount: FinancialAccountRef | null;
  paymentMethod: keyof typeof PAYMENT_METHOD_LABEL;
  paymentDay: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
};

type TableFilterProps = {
  tableFilter: string;
  onTableFilterChange: (value: string) => void;
};

function ExpensesTab({ tableFilter, onTableFilterChange }: TableFilterProps) {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();

  const [monthStr, setMonthStr] = React.useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const monthDate = React.useMemo(
    () => parseISO(`${monthStr}-01T12:00:00`),
    [monthStr],
  );

  const { data: rows = [], isLoading } = trpc.expense.list.useQuery({
    month: monthDate,
  });
  const { data: tags = [] } = trpc.tag.list.useQuery();
  const { data: accounts = [] } = trpc.financialAccount.list.useQuery();

  const createMut = trpc.expense.create.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense added.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.expense.update.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.expense.delete.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const setPaidMut = trpc.expense.setPaid.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const generateMut = trpc.expense.generateMonth.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Month synced.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredExpenseRows = React.useMemo(
    () => filterRowsByGlobalFilter(rows as ExpenseRow[], tableFilter),
    [rows, tableFilter],
  );

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);
  const [detailRow, setDetailRow] = React.useState<ExpenseRow | null>(null);

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      description: "",
      tagId: "",
      financialAccountId: "",
      paymentMethod: "MANUAL",
      paid: false,
    },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        amount: editing.amount,
        date: new Date(editing.date).toISOString().slice(0, 10),
        description: editing.description ?? "",
        tagId: editing.tagId ?? "",
        financialAccountId: editing.financialAccountId ?? "",
        paymentMethod: editing.paymentMethod,
        paid: editing.paid,
      });
    } else {
      form.reset({
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        description: "",
        tagId: "",
        financialAccountId: "",
        paymentMethod: "MANUAL",
        paid: false,
      });
    }
  }, [editing, form, open]);

  function onSubmit(values: ExpenseForm) {
    const payload = {
      amount: values.amount,
      date: new Date(values.date),
      description: values.description || undefined,
      tagId: values.tagId || null,
      financialAccountId: values.financialAccountId || null,
      paymentMethod: values.paymentMethod,
      paid: values.paid,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
    setOpen(false);
    setEditing(null);
  }

  const columns: ColumnDef<ExpenseRow>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: "kind",
      header: "",
      meta: { className: "hidden sm:table-cell w-[6rem]" },
      cell: ({ row }) =>
        row.original.expenseStreamId ? (
          <Badge variant="outline" className="font-normal">
            Recurring
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            One-off
          </Badge>
        ),
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) => row.original.description || "—",
    },
    {
      id: "tag",
      header: "Tag",
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) => row.original.tag?.name ?? "—",
    },
    {
      id: "financialAccount",
      header: "Account",
      meta: { className: "hidden md:table-cell min-w-[10rem]" },
      cell: ({ row }) => {
        const fa = row.original.financialAccount;
        if (!fa) return "—";
        return (
          <span className="text-sm">
            <span>{fa.name}</span>
            <span className="text-muted-foreground ml-1 text-xs">
              ({FINANCIAL_ACCOUNT_KIND_LABEL[fa.kind]})
            </span>
          </span>
        );
      },
    },
    {
      id: "paymentMethod",
      header: "How it pays",
      meta: { className: "hidden xl:table-cell w-[9rem]" },
      cell: ({ row }) => PAYMENT_METHOD_LABEL[row.original.paymentMethod],
    },
    {
      id: "status",
      header: "Status",
      meta: { className: "hidden md:table-cell w-[7rem]" },
      cell: ({ row }) =>
        row.original.paid ? (
          <Badge variant="secondary" className="font-normal">
            Paid
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="font-normal text-amber-800 dark:text-amber-400"
          >
            Pending
          </Badge>
        ),
    },
    {
      accessorKey: "amount",
      header: () => (
        <div className="text-right">
          Amount ({fmt.symbol})
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-destructive text-right font-medium tabular-nums">
          {fmt(row.original.amount)}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="px-2"
              aria-label="Actions"
            >
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={setPaidMut.isPending}
              onClick={() => {
                const r = row.original;
                setPaidMut.mutate({ id: r.id, paid: !r.paid });
              }}
            >
              {row.original.paid ? (
                <>
                  <IconCircle className="size-4" />
                  Mark as pending
                </>
              ) : (
                <>
                  <IconCircleCheck className="size-4" />
                  Mark as paid
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setOpen(true);
              }}
            >
              <IconPencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deleteMut.mutate({ id: row.original.id })}
            >
              <IconTrash className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          One-off and recurring expenses for the selected month. Tag card paydowns (for example{" "}
          <span className="text-foreground">Credit card</span>) in the form. Set up repeating
          charges on the <span className="text-foreground">Recurring</span> tab.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add expense
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() =>
              setMonthStr((m) => format(subMonths(parseISO(`${m}-01`), 1), "yyyy-MM"))
            }
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <IconCalendarMonth className="text-muted-foreground size-4" aria-hidden />
            <Input
              type="month"
              className="w-[11rem]"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() =>
              setMonthStr((m) => format(addMonths(parseISO(`${m}-01`), 1), "yyyy-MM"))
            }
          >
            <IconChevronRight className="size-4" />
          </Button>
          <Button
            variant="secondary"
            disabled={generateMut.isPending}
            onClick={() => generateMut.mutate({ month: monthDate })}
            title="Generate recurring rows for this month and remove duplicates"
          >
            Sync month
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <Input
            type="search"
            placeholder="Search…"
            value={tableFilter}
            onChange={(e) => onTableFilterChange(e.target.value)}
            className="max-w-sm"
            aria-label="Search expenses"
          />
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              data={rows as ExpenseRow[]}
              mobileScrollHint="Swipe sideways to see all columns."
              globalFilter={tableFilter}
              onGlobalFilterChange={onTableFilterChange}
              hideFilterInput
            />
          </div>
          <div className="sm:hidden space-y-2">
            {filteredExpenseRows.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm shadow-sm">
                {Boolean(tableFilter.trim()) && rows.length > 0
                  ? "No rows match your filter."
                  : "No rows yet."}
              </div>
            ) : (
              filteredExpenseRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-stretch gap-1 rounded-lg border border-border/80 bg-card shadow-sm"
                >
                  <button
                    type="button"
                    className="hover:bg-muted/50 active:bg-muted/70 min-w-0 flex-1 px-3 py-3 text-left text-sm transition-colors"
                    onClick={() => setDetailRow(row)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground line-clamp-2 font-medium leading-snug">
                          {row.description?.trim() || "No description"}
                        </p>
                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {row.paid ? (
                            <Badge variant="secondary" className="font-normal">
                              Paid
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-normal text-amber-800 dark:text-amber-400"
                            >
                              Pending
                            </Badge>
                          )}
                          <span>
                            {formatDate(row.date)}
                            {row.financialAccount
                              ? ` · ${row.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[row.financialAccount.kind]})`
                              : ""}
                          </span>
                        </p>
                      </div>
                      <span className="text-destructive shrink-0 font-semibold tabular-nums">
                        {fmt(row.amount)}
                      </span>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 self-center px-2"
                        aria-label="Actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconDotsVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={setPaidMut.isPending}
                        onClick={() => {
                          setPaidMut.mutate({ id: row.id, paid: !row.paid });
                        }}
                      >
                        {row.paid ? (
                          <>
                            <IconCircle className="size-4" />
                            Mark as pending
                          </>
                        ) : (
                          <>
                            <IconCircleCheck className="size-4" />
                            Mark as paid
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(row);
                          setOpen(true);
                        }}
                      >
                        <IconPencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteMut.mutate({ id: row.id })}
                      >
                        <IconTrash className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="e-amount">Amount ({fmt.symbol})</Label>
              <Input id="e-amount" type="number" step="0.01" min="0" {...form.register("amount")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-desc">Description (optional)</Label>
              <Input id="e-desc" {...form.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label>Tag (optional)</Label>
              <Select
                value={form.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("tagId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Account (optional)</Label>
              <Select
                value={form.watch("financialAccountId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("financialAccountId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({FINANCIAL_ACCOUNT_KIND_LABEL[a.kind]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Savings, checking, cards, e-wallets (e.g. GCash, Maya). Add accounts in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
            </div>
            <div className="grid gap-2">
              <Label>How it pays</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(v) =>
                  form.setValue(
                    "paymentMethod",
                    v as keyof typeof PAYMENT_METHOD_LABEL,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_METHOD_LABEL) as Array<
                    keyof typeof PAYMENT_METHOD_LABEL
                  >).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAYMENT_METHOD_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="e-paid"
                checked={form.watch("paid")}
                onCheckedChange={(c) => form.setValue("paid", c === true)}
              />
              <Label htmlFor="e-paid" className="font-normal">
                Paid
              </Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={detailRow != null}
        onOpenChange={(v) => {
          if (!v) setDetailRow(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-0 sm:max-w-lg"
        >
          {detailRow ? (
            <>
              <SheetHeader className="px-6 pb-2 text-left">
                <SheetTitle className="text-base leading-snug">
                  {detailRow.description?.trim() || "Expense"}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  View expense details. Use Edit to change this expense.
                </SheetDescription>
              </SheetHeader>
              <div className="text-foreground space-y-0 px-6 text-sm">
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-destructive font-semibold tabular-nums">
                    {fmt(detailRow.amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDate(detailRow.date)}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Kind</span>
                  <span>
                    {detailRow.expenseStreamId ? "Recurring" : "One-off"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Tag</span>
                  <span className="text-right">{detailRow.tag?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Account</span>
                  <span className="text-right">
                    {detailRow.financialAccount
                      ? `${detailRow.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[detailRow.financialAccount.kind]})`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">How it pays</span>
                  <span className="text-right">
                    {PAYMENT_METHOD_LABEL[detailRow.paymentMethod]}
                  </span>
                </div>
                <div className="flex justify-between gap-4 py-2.5">
                  <span className="text-muted-foreground">Status</span>
                  <span>{detailRow.paid ? "Paid" : "Pending"}</span>
                </div>
              </div>
              <SheetFooter className="mt-auto grid grid-cols-2 gap-2 border-t border-border/80 p-6 pt-4">
                <Button
                  type="button"
                  variant="default"
                  className="min-w-0"
                  disabled={setPaidMut.isPending}
                  onClick={() => {
                    const r = detailRow;
                    if (!r) return;
                    setPaidMut.mutate(
                      { id: r.id, paid: !r.paid },
                      {
                        onSuccess: () => {
                          setDetailRow((d) =>
                            d && d.id === r.id ? { ...d, paid: !d.paid } : d,
                          );
                        },
                      },
                    );
                  }}
                >
                  {detailRow.paid ? (
                    <>
                      <IconCircle className="size-4" />
                      Mark as pending
                    </>
                  ) : (
                    <>
                      <IconCircleCheck className="size-4" />
                      Mark as paid
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0"
                  onClick={() => {
                    const r = detailRow;
                    setDetailRow(null);
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <IconPencil className="size-4" />
                  Edit
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RecurringExpensesTab({ tableFilter, onTableFilterChange }: TableFilterProps) {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.expense.stream.list.useQuery();
  const { data: tags = [] } = trpc.tag.list.useQuery();
  const { data: accounts = [] } = trpc.financialAccount.list.useQuery();

  const createMut = trpc.expense.stream.create.useMutation({
    onSuccess: () => {
      void utils.expense.stream.list.invalidate();
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Recurring expense saved.");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.expense.stream.update.useMutation({
    onSuccess: () => {
      void utils.expense.stream.list.invalidate();
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Recurring expense updated.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.expense.stream.delete.useMutation({
    onSuccess: () => {
      void utils.expense.stream.list.invalidate();
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Recurring expense deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredStreamRows = React.useMemo(
    () => filterRowsByGlobalFilter(rows as ExpenseStreamRow[], tableFilter),
    [rows, tableFilter],
  );

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseStreamRow | null>(null);
  const [detailStream, setDetailStream] = React.useState<ExpenseStreamRow | null>(
    null,
  );

  const form = useForm<ExpenseStreamForm>({
    resolver: zodResolver(expenseStreamSchema),
    defaultValues: {
      amount: 0,
      description: "",
      tagId: "",
      financialAccountId: "",
      paymentMethod: "MANUAL",
      paymentDay: 1,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        amount: editing.amount,
        description: editing.description ?? "",
        tagId: editing.tagId ?? "",
        financialAccountId: editing.financialAccountId ?? "",
        paymentMethod: editing.paymentMethod,
        paymentDay: editing.paymentDay,
        startDate: new Date(editing.startDate).toISOString().slice(0, 10),
        endDate: editing.endDate
          ? new Date(editing.endDate).toISOString().slice(0, 10)
          : "",
        isActive: editing.isActive,
      });
    } else {
      form.reset({
        amount: 0,
        description: "",
        tagId: "",
        financialAccountId: "",
        paymentMethod: "MANUAL",
        paymentDay: 1,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        isActive: true,
      });
    }
  }, [editing, form, open]);

  function onSubmit(values: ExpenseStreamForm) {
    const payload = {
      amount: values.amount,
      description: values.description || undefined,
      tagId: values.tagId || null,
      financialAccountId: values.financialAccountId || null,
      paymentMethod: values.paymentMethod,
      paymentDay: values.paymentDay,
      startDate: new Date(values.startDate),
      endDate: values.endDate?.trim() ? new Date(values.endDate) : null,
      isActive: values.isActive,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
    setOpen(false);
    setEditing(null);
  }

  const columns: ColumnDef<ExpenseStreamRow>[] = [
    {
      id: "period",
      header: "Active period",
      cell: ({ row }) =>
        formatIncomePeriod(row.original.startDate, row.original.endDate),
    },
    {
      id: "paymentDay",
      header: "Day",
      meta: { className: "hidden sm:table-cell w-[4rem]" },
      cell: ({ row }) => row.original.paymentDay,
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => row.original.description?.trim() || "—",
    },
    {
      accessorKey: "tag.name",
      header: "Tag",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => row.original.tag?.name ?? "—",
    },
    {
      id: "financialAccount",
      header: "Account",
      meta: { className: "hidden md:table-cell min-w-[10rem]" },
      cell: ({ row }) => {
        const fa = row.original.financialAccount;
        if (!fa) return "—";
        return (
          <span className="text-sm">
            <span>{fa.name}</span>
            <span className="text-muted-foreground ml-1 text-xs">
              ({FINANCIAL_ACCOUNT_KIND_LABEL[fa.kind]})
            </span>
          </span>
        );
      },
    },
    {
      id: "paymentMethod",
      header: "How it pays",
      meta: { className: "hidden xl:table-cell w-[9rem]" },
      cell: ({ row }) => PAYMENT_METHOD_LABEL[row.original.paymentMethod],
    },
    {
      accessorKey: "amount",
      header: () => (
        <div className="text-right">
          Amount ({fmt.symbol})
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-destructive text-right font-medium tabular-nums">
          {fmt(row.original.amount)}
        </div>
      ),
    },
    {
      id: "active",
      header: "On",
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary" className="font-normal">
            Yes
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal">
            Off
          </Badge>
        ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="px-2"
              aria-label="Actions"
            >
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setOpen(true);
              }}
            >
              <IconPencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deleteMut.mutate({ id: row.original.id })}
            >
              <IconTrash className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Expected monthly charges (rent, subscriptions, card paydowns, and similar). Tag items such
          as <span className="text-foreground">Credit card</span> when relevant. One row per month
          appears on <span className="text-foreground">Regular</span> when you open or sync that
          month.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add recurring
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <Input
            type="search"
            placeholder="Search…"
            value={tableFilter}
            onChange={(e) => onTableFilterChange(e.target.value)}
            className="max-w-sm"
            aria-label="Search recurring expenses"
          />
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              data={rows as ExpenseStreamRow[]}
              mobileScrollHint="Swipe sideways to see all columns."
              globalFilter={tableFilter}
              onGlobalFilterChange={onTableFilterChange}
              hideFilterInput
            />
          </div>
          <div className="sm:hidden space-y-2">
            {filteredStreamRows.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm shadow-sm">
                {Boolean(tableFilter.trim()) && rows.length > 0
                  ? "No rows match your filter."
                  : "No rows yet."}
              </div>
            ) : (
              filteredStreamRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-stretch gap-1 rounded-lg border border-border/80 bg-card shadow-sm"
                >
                  <button
                    type="button"
                    className="hover:bg-muted/50 active:bg-muted/70 min-w-0 flex-1 px-3 py-3 text-left text-sm transition-colors"
                    onClick={() => setDetailStream(row)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground line-clamp-2 font-medium leading-snug">
                          {row.description?.trim() || "Recurring expense"}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Day {row.paymentDay}
                          {" · "}
                          {formatIncomePeriod(row.startDate, row.endDate)}
                          {row.financialAccount
                            ? ` · ${row.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[row.financialAccount.kind]})`
                            : ""}
                        </p>
                      </div>
                      <span className="text-destructive shrink-0 font-semibold tabular-nums">
                        {fmt(row.amount)}
                      </span>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 self-center px-2"
                        aria-label="Actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconDotsVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(row);
                          setOpen(true);
                        }}
                      >
                        <IconPencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteMut.mutate({ id: row.id })}
                      >
                        <IconTrash className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit recurring expense" : "Add recurring expense"}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="es-amount">
                Amount ({fmt.symbol}, per month)
              </Label>
              <Input
                id="es-amount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("amount")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="es-day">Day of month</Label>
              <Input
                id="es-day"
                type="number"
                min={1}
                max={31}
                {...form.register("paymentDay")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="es-start">Start date</Label>
              <Input id="es-start" type="date" {...form.register("startDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="es-end">End date (optional)</Label>
              <Input id="es-end" type="date" {...form.register("endDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="es-desc">Description (optional)</Label>
              <Input id="es-desc" {...form.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label>Tag (optional)</Label>
              <Select
                value={form.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("tagId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Account (optional)</Label>
              <Select
                value={form.watch("financialAccountId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("financialAccountId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({FINANCIAL_ACCOUNT_KIND_LABEL[a.kind]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Add or manage accounts in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
            </div>
            <div className="grid gap-2">
              <Label>How it pays</Label>
              <Select
                value={form.watch("paymentMethod")}
                onValueChange={(v) =>
                  form.setValue(
                    "paymentMethod",
                    v as keyof typeof PAYMENT_METHOD_LABEL,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_METHOD_LABEL) as Array<
                    keyof typeof PAYMENT_METHOD_LABEL
                  >).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAYMENT_METHOD_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="es-active"
                checked={form.watch("isActive")}
                onCheckedChange={(c) => form.setValue("isActive", c === true)}
              />
              <Label htmlFor="es-active" className="font-normal">
                Active
              </Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={detailStream != null}
        onOpenChange={(v) => {
          if (!v) setDetailStream(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-0 sm:max-w-lg"
        >
          {detailStream ? (
            <>
              <SheetHeader className="px-6 pb-2 text-left">
                <SheetTitle className="text-base leading-snug">
                  {detailStream.description?.trim() || "Recurring expense"}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  View recurring expense details. Use Edit to change this template.
                </SheetDescription>
              </SheetHeader>
              <div className="text-foreground space-y-0 px-6 text-sm">
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Amount / month</span>
                  <span className="text-destructive font-semibold tabular-nums">
                    {fmt(detailStream.amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Day of month</span>
                  <span>{detailStream.paymentDay}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Active period</span>
                  <span className="text-right">
                    {formatIncomePeriod(detailStream.startDate, detailStream.endDate)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Tag</span>
                  <span className="text-right">{detailStream.tag?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">Account</span>
                  <span className="text-right">
                    {detailStream.financialAccount
                      ? `${detailStream.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[detailStream.financialAccount.kind]})`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <span className="text-muted-foreground">How it pays</span>
                  <span className="text-right">
                    {PAYMENT_METHOD_LABEL[detailStream.paymentMethod]}
                  </span>
                </div>
                <div className="flex justify-between gap-4 py-2.5">
                  <span className="text-muted-foreground">Active</span>
                  <span>{detailStream.isActive ? "Yes" : "Off"}</span>
                </div>
              </div>
              <SheetFooter className="border-t border-border/80 sm:flex-col">
                <Button
                  className="w-full"
                  onClick={() => {
                    const r = detailStream;
                    setDetailStream(null);
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  <IconPencil className="size-4" />
                  Edit
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const expenseTabValues = ["regular", "recurring"] as const;

export function ExpensesPage() {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(expenseTabValues).withDefault("regular"),
  );
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ throttleMs: 300 }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground text-sm">
          Track one-off and recurring spending. Use a tag (for example, Credit card) to group card
          paydowns.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          void setTab(v as (typeof expenseTabValues)[number]);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="regular">Regular</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
        <TabsContent value="regular" className="mt-4">
          <ExpensesTab tableFilter={q} onTableFilterChange={setQ} />
        </TabsContent>
        <TabsContent value="recurring" className="mt-4">
          <RecurringExpensesTab tableFilter={q} onTableFilterChange={setQ} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
