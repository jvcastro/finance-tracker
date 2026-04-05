"use client";

import * as React from "react";
import { zodResolver } from "@/lib/zod-resolver";
import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

const expenseSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
  tagId: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

type ExpenseRow = {
  id: string;
  amount: number;
  date: Date;
  description: string | null;
  tagId: string | null;
  tag: { id: string; name: string } | null;
};

const debtSchema = z.object({
  fromAccount: z.string().min(1),
  toAccount: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  note: z.string().optional(),
});

type DebtForm = z.infer<typeof debtSchema>;

type DebtRow = {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: Date;
  note: string | null;
};

type TableFilterProps = {
  tableFilter: string;
  onTableFilterChange: (value: string) => void;
};

function ExpensesTab({ tableFilter, onTableFilterChange }: TableFilterProps) {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.expense.list.useQuery();
  const { data: tags = [] } = trpc.tag.list.useQuery();
  const createMut = trpc.expense.create.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.expense.update.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.expense.delete.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Expense deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      description: "",
      tagId: "",
    },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        amount: editing.amount,
        date: new Date(editing.date).toISOString().slice(0, 10),
        description: editing.description ?? "",
        tagId: editing.tagId ?? "",
      });
    } else {
      form.reset({
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        description: "",
        tagId: "",
      });
    }
  }, [editing, form, open]);

  function onSubmit(values: ExpenseForm) {
    const payload = {
      amount: values.amount,
      date: new Date(values.date),
      description: values.description || undefined,
      tagId: values.tagId || null,
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
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
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
            <Button variant="ghost" size="icon-xs" aria-label="Actions">
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
          Day-to-day spending. Use the Credit card tab for pay-downs or transfers.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add expense
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows as ExpenseRow[]}
          mobileScrollHint="Swipe sideways to see description and tag."
          globalFilter={tableFilter}
          onGlobalFilterChange={onTableFilterChange}
        />
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
              <Label htmlFor="e-amount">Amount</Label>
              <Input id="e-amount" type="number" step="0.01" min="0" {...form.register("amount")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-desc">Description</Label>
              <Input id="e-desc" {...form.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label>Tag</Label>
              <Select
                value={form.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("tagId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
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
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditCardTab({ tableFilter, onTableFilterChange }: TableFilterProps) {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.creditCardDebt.list.useQuery();
  const createMut = trpc.creditCardDebt.create.useMutation({
    onSuccess: () => {
      void utils.creditCardDebt.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Entry saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.creditCardDebt.update.useMutation({
    onSuccess: () => {
      void utils.creditCardDebt.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Entry updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.creditCardDebt.delete.useMutation({
    onSuccess: () => {
      void utils.creditCardDebt.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Entry deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DebtRow | null>(null);

  const form = useForm<DebtForm>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      fromAccount: "",
      toAccount: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        fromAccount: editing.fromAccount,
        toAccount: editing.toAccount,
        amount: editing.amount,
        date: new Date(editing.date).toISOString().slice(0, 10),
        note: editing.note ?? "",
      });
    } else {
      form.reset({
        fromAccount: "",
        toAccount: "",
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        note: "",
      });
    }
  }, [editing, form, open]);

  function onSubmit(values: DebtForm) {
    const payload = {
      fromAccount: values.fromAccount,
      toAccount: values.toAccount,
      amount: values.amount,
      date: new Date(values.date),
      note: values.note || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
    setOpen(false);
    setEditing(null);
  }

  const columns: ColumnDef<DebtRow>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "fromAccount",
      header: "From",
      meta: { className: "max-w-[6rem] truncate sm:max-w-none" },
      cell: ({ row }) => row.original.fromAccount,
    },
    {
      accessorKey: "toAccount",
      header: "To",
      meta: { className: "max-w-[6rem] truncate sm:max-w-none" },
      cell: ({ row }) => row.original.toAccount,
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {fmt(row.original.amount)}
        </div>
      ),
    },
    {
      id: "note",
      header: "Note",
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) => row.original.note || "—",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Actions">
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
        <p className="text-muted-foreground max-w-prose text-sm">
          Log credit card payments or balance transfers: <strong>From</strong> (e.g. card or
          issuer) and <strong>To</strong> (e.g. checking account you paid from, or destination
          card), plus <strong>amount</strong> and date.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add entry
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows as DebtRow[]}
          mobileScrollHint="Swipe sideways for notes and full account names."
          globalFilter={tableFilter}
          onGlobalFilterChange={onTableFilterChange}
        />
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
              {editing ? "Edit credit card entry" : "Add credit card entry"}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                placeholder="e.g. Chase Sapphire"
                {...form.register("fromAccount")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                placeholder="e.g. Bank of America checking"
                {...form.register("toAccount")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="d-amount">Amount</Label>
              <Input id="d-amount" type="number" step="0.01" min="0" {...form.register("amount")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="d-date">Date</Label>
              <Input id="d-date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" rows={2} {...form.register("note")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const expenseTabValues = ["regular", "cards"] as const;

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
          Regular expenses and dedicated credit card payment lines.
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
          <TabsTrigger value="cards">Credit card</TabsTrigger>
        </TabsList>
        <TabsContent value="regular" className="mt-4">
          <ExpensesTab tableFilter={q} onTableFilterChange={setQ} />
        </TabsContent>
        <TabsContent value="cards" className="mt-4">
          <CreditCardTab tableFilter={q} onTableFilterChange={setQ} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
