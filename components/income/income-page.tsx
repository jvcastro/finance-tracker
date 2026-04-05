"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconDotsVertical, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
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
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

const formSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
  tagId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type IncomeRow = {
  id: string;
  amount: number;
  date: Date;
  description: string | null;
  tagId: string | null;
  tag: { id: string; name: string } | null;
};

export function IncomePage() {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.income.list.useQuery();
  const { data: tags = [] } = trpc.tag.list.useQuery();
  const createMut = trpc.income.create.useMutation({
    onSuccess: () => {
      void utils.income.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Income added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.income.update.useMutation({
    onSuccess: () => {
      void utils.income.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Income updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.income.delete.useMutation({
    onSuccess: () => {
      void utils.income.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Income deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IncomeRow | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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

  function onSubmit(values: FormValues) {
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

  const columns: ColumnDef<IncomeRow>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => row.original.description || "—",
    },
    {
      accessorKey: "tag.name",
      header: "Tag",
      cell: ({ row }) => row.original.tag?.name ?? "—",
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => (
        <div className="text-chart-2 text-right font-medium tabular-nums">
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
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Income</h1>
          <p className="text-muted-foreground text-sm">
            Track money coming in. Amounts use your Settings currency.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add income
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <DataTable columns={columns} data={rows as IncomeRow[]} />
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
            <DialogTitle>{editing ? "Edit income" : "Add income"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("amount")}
              />
              {form.formState.errors.amount ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.amount.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...form.register("description")} />
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
