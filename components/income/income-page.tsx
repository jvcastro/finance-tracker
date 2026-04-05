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
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { formatDate, formatIncomePeriod } from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

const streamFormSchema = z
  .object({
    amount: z.coerce.number().positive(),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
    description: z.string().optional(),
    sourceType: z.enum(["SALARY", "PROJECT", "OTHER"]),
    sourceName: z.string().max(200).optional(),
    salaryPaySchedule: z.enum(["MONTHLY", "BI_WEEKLY", "ONE_OFF"]).optional(),
    paymentDay: z.coerce.number().int().min(1).max(31),
    secondPaymentDay: z.coerce.number().int().min(1).max(31).optional(),
    tagId: z.string().optional(),
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
    if (data.sourceType === "SALARY" && !data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Choose how often your employer pays you.",
        path: ["salaryPaySchedule"],
      });
    }
    if (data.sourceType !== "SALARY" && data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Pay schedule applies only to company salary.",
        path: ["salaryPaySchedule"],
      });
    }
    if (
      data.sourceType === "SALARY" &&
      data.salaryPaySchedule === "BI_WEEKLY" &&
      (data.secondPaymentDay == null || Number.isNaN(data.secondPaymentDay))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Add a second pay day (e.g. 30).",
        path: ["secondPaymentDay"],
      });
    }
    if (
      data.sourceType === "SALARY" &&
      data.salaryPaySchedule === "BI_WEEKLY" &&
      data.secondPaymentDay != null &&
      data.secondPaymentDay === data.paymentDay
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Use two different days (e.g. 15 and 30).",
        path: ["secondPaymentDay"],
      });
    }
  });

type StreamFormValues = z.infer<typeof streamFormSchema>;

type StreamRow = {
  id: string;
  amount: number;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  sourceType: "SALARY" | "PROJECT" | "OTHER";
  sourceName: string | null;
  salaryPaySchedule: "MONTHLY" | "BI_WEEKLY" | "ONE_OFF" | null;
  paymentDay: number;
  secondPaymentDay: number | null;
  isActive: boolean;
  tagId: string | null;
  tag: { id: string; name: string } | null;
};

const SOURCE_LABEL: Record<StreamRow["sourceType"], string> = {
  SALARY: "Salary",
  PROJECT: "Project",
  OTHER: "Other",
};

const SALARY_SCHEDULE_LABEL: Record<
  NonNullable<StreamRow["salaryPaySchedule"]>,
  string
> = {
  MONTHLY: "Monthly pay",
  BI_WEEKLY: "Bi-weekly pay",
  ONE_OFF: "One-off",
};

const recordEditSchema = z.object({
  amount: z.coerce.number().positive(),
  received: z.boolean(),
  description: z.string().optional(),
  tagId: z.string().optional(),
});

const manualSchema = z
  .object({
    scheduledDate: z.string().min(1),
    amount: z.coerce.number().positive(),
    sourceType: z.enum(["SALARY", "PROJECT", "OTHER"]),
    sourceName: z.string().max(200).optional(),
    salaryPaySchedule: z.enum(["MONTHLY", "BI_WEEKLY", "ONE_OFF"]).optional(),
    description: z.string().optional(),
    received: z.boolean(),
    tagId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "SALARY" && !data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Choose pay schedule for salary.",
        path: ["salaryPaySchedule"],
      });
    }
    if (data.sourceType !== "SALARY" && data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Pay schedule applies only to salary.",
        path: ["salaryPaySchedule"],
      });
    }
  });

type RecordRow = {
  id: string;
  incomeStreamId: string | null;
  scheduledDate: Date;
  amount: number;
  received: boolean;
  description: string | null;
  sourceType: "SALARY" | "PROJECT" | "OTHER" | null;
  sourceName: string | null;
  salaryPaySchedule: "MONTHLY" | "BI_WEEKLY" | "ONE_OFF" | null;
  tag: { id: string; name: string } | null;
  incomeStream: {
    sourceType: string;
    sourceName: string | null;
    salaryPaySchedule: string | null;
  } | null;
};

function resolveRecordSourceType(r: RecordRow) {
  return (r.incomeStream?.sourceType ?? r.sourceType ?? "OTHER") as
    | "SALARY"
    | "PROJECT"
    | "OTHER";
}

function recordLabel(r: RecordRow) {
  const fromStream = r.incomeStream?.sourceName?.trim();
  const manual = r.sourceName?.trim();
  if (fromStream) return fromStream;
  if (manual) return manual;
  return r.description?.trim() || "Income";
}

function formatStreamPayDays(r: StreamRow) {
  if (r.sourceType === "SALARY" && r.salaryPaySchedule === "BI_WEEKLY") {
    const a = r.paymentDay;
    const b = r.secondPaymentDay;
    if (b != null) return `${a} & ${b}`;
  }
  return String(r.paymentDay);
}

const incomeTabValues = ["records", "streams"] as const;

export function IncomePage() {
  const fmt = useCurrencyFormatter();
  const utils = trpc.useUtils();

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(incomeTabValues).withDefault("records"),
  );
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ throttleMs: 300 }),
  );

  const [monthStr, setMonthStr] = React.useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const monthDate = React.useMemo(
    () => parseISO(`${monthStr}-01T12:00:00`),
    [monthStr],
  );

  const { data: records = [], isLoading: loadingRecords } =
    trpc.income.record.list.useQuery({ month: monthDate });
  const { data: streams = [], isLoading: loadingStreams } =
    trpc.income.stream.list.useQuery();

  const createStreamMut = trpc.income.stream.create.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Recurring income saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateStreamMut = trpc.income.stream.update.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteStreamMut = trpc.income.stream.delete.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate();
      void utils.income.record.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateMut = trpc.income.record.generateMonth.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Monthly rows synced");
    },
    onError: (e) => toast.error(e.message),
  });

  const createManualMut = trpc.income.record.createManual.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Record added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateRecordMut = trpc.income.record.update.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteRecordMut = trpc.income.record.delete.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate();
      void utils.dashboard.summary.invalidate();
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: tags = [] } = trpc.tag.list.useQuery();

  const [streamOpen, setStreamOpen] = React.useState(false);
  const [editingStream, setEditingStream] = React.useState<StreamRow | null>(
    null,
  );

  const [recordOpen, setRecordOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<RecordRow | null>(
    null,
  );

  const [manualOpen, setManualOpen] = React.useState(false);

  const streamForm = useForm<StreamFormValues>({
    resolver: zodResolver(streamFormSchema),
    defaultValues: {
      amount: 0,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      description: "",
      sourceType: "OTHER",
      sourceName: "",
      salaryPaySchedule: undefined,
      paymentDay: 15,
      secondPaymentDay: 30,
      tagId: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (editingStream) {
      streamForm.reset({
        amount: editingStream.amount,
        startDate: new Date(editingStream.startDate).toISOString().slice(0, 10),
        endDate: editingStream.endDate
          ? new Date(editingStream.endDate).toISOString().slice(0, 10)
          : "",
        description: editingStream.description ?? "",
        sourceType: editingStream.sourceType,
        sourceName: editingStream.sourceName ?? "",
        salaryPaySchedule:
          editingStream.sourceType === "SALARY"
            ? editingStream.salaryPaySchedule ?? "MONTHLY"
            : undefined,
        paymentDay: editingStream.paymentDay,
        secondPaymentDay: editingStream.secondPaymentDay ?? 30,
        tagId: editingStream.tagId ?? "",
        isActive: editingStream.isActive,
      });
    } else {
      streamForm.reset({
        amount: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        description: "",
        sourceType: "OTHER",
        sourceName: "",
        salaryPaySchedule: undefined,
        paymentDay: 15,
        secondPaymentDay: 30,
        tagId: "",
        isActive: true,
      });
    }
  }, [editingStream, streamForm, streamOpen]);

  const recordForm = useForm<z.infer<typeof recordEditSchema>>({
    resolver: zodResolver(recordEditSchema),
    defaultValues: { amount: 0, received: false, description: "", tagId: "" },
  });

  React.useEffect(() => {
    if (editingRecord) {
      recordForm.reset({
        amount: editingRecord.amount,
        received: editingRecord.received,
        description: editingRecord.description ?? "",
        tagId: editingRecord.tag?.id ?? "",
      });
    }
  }, [editingRecord, recordForm, recordOpen]);

  const manualForm = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      scheduledDate: `${monthStr}-01`,
      amount: 0,
      sourceType: "OTHER",
      sourceName: "",
      salaryPaySchedule: undefined,
      description: "",
      received: false,
      tagId: "",
    },
  });

  React.useEffect(() => {
    if (manualOpen) {
      manualForm.setValue("scheduledDate", `${monthStr}-01`);
    }
  }, [manualOpen, monthStr, manualForm]);

  function onStreamSubmit(values: StreamFormValues) {
    const isBiWeekly =
      values.sourceType === "SALARY" && values.salaryPaySchedule === "BI_WEEKLY";
    const payload = {
      amount: values.amount,
      startDate: new Date(values.startDate),
      endDate: values.endDate?.trim() ? new Date(values.endDate) : null,
      description: values.description || undefined,
      sourceType: values.sourceType,
      sourceName: values.sourceName?.trim() || null,
      salaryPaySchedule:
        values.sourceType === "SALARY"
          ? values.salaryPaySchedule ?? "MONTHLY"
          : null,
      paymentDay: values.paymentDay,
      secondPaymentDay: isBiWeekly ? values.secondPaymentDay ?? null : null,
      tagId: values.tagId || null,
      isActive: values.isActive,
    };
    if (editingStream) {
      updateStreamMut.mutate({ id: editingStream.id, ...payload });
    } else {
      createStreamMut.mutate(payload);
    }
    setStreamOpen(false);
    setEditingStream(null);
  }

  function onRecordSubmit(values: z.infer<typeof recordEditSchema>) {
    if (!editingRecord) return;
    updateRecordMut.mutate({
      id: editingRecord.id,
      amount: values.amount,
      received: values.received,
      description: values.description || null,
      tagId: values.tagId || null,
    });
    setRecordOpen(false);
    setEditingRecord(null);
  }

  function onManualSubmit(values: z.infer<typeof manualSchema>) {
    const scheduledDate = new Date(`${values.scheduledDate}T12:00:00`);
    createManualMut.mutate({
      scheduledDate,
      amount: values.amount,
      sourceType: values.sourceType,
      sourceName: values.sourceName?.trim() || null,
      salaryPaySchedule:
        values.sourceType === "SALARY"
          ? values.salaryPaySchedule ?? "MONTHLY"
          : null,
      description: values.description || undefined,
      received: values.received,
      tagId: values.tagId || null,
    });
    setManualOpen(false);
  }

  const streamColumns: ColumnDef<StreamRow>[] = [
    {
      id: "period",
      header: "Active period",
      cell: ({ row }) =>
        formatIncomePeriod(row.original.startDate, row.original.endDate),
    },
    {
      accessorKey: "sourceType",
      header: "Source",
      cell: ({ row }) => SOURCE_LABEL[row.original.sourceType],
    },
    {
      id: "salaryPaySchedule",
      header: "Salary pay",
      meta: { className: "hidden lg:table-cell" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.sourceType !== "SALARY" || !r.salaryPaySchedule) return "—";
        return SALARY_SCHEDULE_LABEL[r.salaryPaySchedule];
      },
    },
    {
      id: "payDays",
      header: "Pay days",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => formatStreamPayDays(row.original),
    },
    {
      id: "name",
      header: "Name",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => row.original.sourceName?.trim() || "—",
    },
    {
      accessorKey: "tag.name",
      header: "Tag",
      meta: { className: "hidden md:table-cell" },
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
            <Button variant="ghost" size="icon-xs" aria-label="Actions">
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditingStream(row.original);
                setStreamOpen(true);
              }}
            >
              <IconPencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deleteStreamMut.mutate({ id: row.original.id })}
            >
              <IconTrash className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const recordColumns: ColumnDef<RecordRow>[] = [
    {
      id: "payDate",
      header: "Pay date",
      cell: ({ row }) => formatDate(row.original.scheduledDate),
    },
    {
      id: "label",
      header: "From",
      cell: ({ row }) => (
        <div className="max-w-[14rem] truncate font-medium">{recordLabel(row.original)}</div>
      ),
    },
    {
      id: "kind",
      header: "",
      meta: { className: "hidden sm:table-cell w-[7rem]" },
      cell: ({ row }) =>
        row.original.incomeStreamId ? (
          <Badge variant="outline" className="font-normal">
            Recurring
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            Manual
          </Badge>
        ),
    },
    {
      accessorKey: "source",
      header: "Type",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => SOURCE_LABEL[resolveRecordSourceType(row.original)],
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.received ? (
          <Badge variant="secondary" className="font-normal">
            Received
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
              disabled={updateRecordMut.isPending}
              onClick={() => {
                const r = row.original;
                updateRecordMut.mutate({
                  id: r.id,
                  received: !r.received,
                  description: r.description,
                  tagId: r.tag?.id ?? null,
                });
              }}
            >
              {row.original.received ? (
                <>
                  <IconCircle className="size-4" />
                  Mark as pending
                </>
              ) : (
                <>
                  <IconCircleCheck className="size-4" />
                  Mark as received
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditingRecord(row.original);
                setRecordOpen(true);
              }}
            >
              <IconPencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => deleteRecordMut.mutate({ id: row.original.id })}
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
            <span className="text-foreground">Recurring</span> = pay rules.{" "}
            <span className="text-foreground">Records</span> = paydays (filled automatically). Mark
            received when paid.
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          void setTab(v as (typeof incomeTabValues)[number]);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="records">Payment records</TabsTrigger>
          <TabsTrigger value="streams">Recurring setup</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <div className="flex flex-col gap-4">
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
                size="sm"
                disabled={generateMut.isPending}
                onClick={() => generateMut.mutate({ month: monthDate })}
                title="Add any missing rows for this month"
              >
                Sync month
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setManualOpen(true);
              }}
            >
              <IconPlus className="size-4" />
              Add manual record
            </Button>
          </div>

          {loadingRecords ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <DataTable
              columns={recordColumns}
              data={records as RecordRow[]}
              mobileScrollHint="Swipe sideways for more columns, or rotate your device."
              globalFilter={q}
              onGlobalFilterChange={setQ}
            />
          )}
          </div>
        </TabsContent>

        <TabsContent value="streams" className="mt-4">
          <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingStream(null);
                setStreamOpen(true);
              }}
            >
              <IconPlus className="size-4" />
              Add recurring income
            </Button>
          </div>
          {loadingStreams ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <DataTable
              columns={streamColumns}
              data={streams as StreamRow[]}
              mobileScrollHint="Swipe sideways for more columns, or rotate your device."
              globalFilter={q}
              onGlobalFilterChange={setQ}
            />
          )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={streamOpen}
        onOpenChange={(v) => {
          setStreamOpen(v);
          if (!v) setEditingStream(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStream ? "Edit recurring income" : "Add recurring income"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={streamForm.handleSubmit(onStreamSubmit)}
          >
            <div className="grid gap-2">
              <Label htmlFor="s-amount">Amount</Label>
              <p className="text-muted-foreground -mt-1 text-xs">
                Gross per month or per paycheck (bi-weekly).
              </p>
              <Input
                id="s-amount"
                type="number"
                step="0.01"
                min="0"
                {...streamForm.register("amount")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select
                value={streamForm.watch("sourceType")}
                onValueChange={(v) => {
                  const t = v as StreamFormValues["sourceType"];
                  streamForm.setValue("sourceType", t);
                  if (t === "SALARY") {
                    streamForm.setValue("salaryPaySchedule", "MONTHLY");
                  } else {
                    streamForm.setValue("salaryPaySchedule", undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALARY">Company salary</SelectItem>
                  <SelectItem value="PROJECT">Project / retainer</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {streamForm.watch("sourceType") !== "SALARY" ? (
              <div className="grid gap-2">
                <Label htmlFor="s-payday">Pay day of month</Label>
                <p className="text-muted-foreground -mt-1 text-xs">1–31 (short months clamp).</p>
                <Input
                  id="s-payday"
                  type="number"
                  min={1}
                  max={31}
                  {...streamForm.register("paymentDay", { valueAsNumber: true })}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="s-start">Start date</Label>
              <Input id="s-start" type="date" {...streamForm.register("startDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-end">End date (optional)</Label>
              <Input id="s-end" type="date" {...streamForm.register("endDate")} />
            </div>
            {streamForm.watch("sourceType") === "SALARY" ? (
              <div className="grid gap-2">
                <Label>Employer pay schedule</Label>
                <Select
                  value={streamForm.watch("salaryPaySchedule") ?? "MONTHLY"}
                  onValueChange={(v) => {
                    const sch = v as StreamFormValues["salaryPaySchedule"];
                    streamForm.setValue("salaryPaySchedule", sch);
                    if (sch === "BI_WEEKLY") {
                      streamForm.setValue("paymentDay", 15);
                      streamForm.setValue("secondPaymentDay", 30);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="BI_WEEKLY">Bi-weekly</SelectItem>
                    <SelectItem value="ONE_OFF">One-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {streamForm.watch("sourceType") === "SALARY" &&
            streamForm.watch("salaryPaySchedule") === "BI_WEEKLY" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="s-pay1">First pay day</Label>
                  <Input
                    id="s-pay1"
                    type="number"
                    min={1}
                    max={31}
                    {...streamForm.register("paymentDay", { valueAsNumber: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="s-pay2">Second pay day</Label>
                  <Input
                    id="s-pay2"
                    type="number"
                    min={1}
                    max={31}
                    {...streamForm.register("secondPaymentDay", { valueAsNumber: true })}
                  />
                </div>
              </div>
            ) : streamForm.watch("sourceType") === "SALARY" ? (
              <div className="grid gap-2">
                <Label htmlFor="s-payday-salary">Pay day of month</Label>
                <p className="text-muted-foreground -mt-1 text-xs">
                  1–31. One-off: first on/after start.
                </p>
                <Input
                  id="s-payday-salary"
                  type="number"
                  min={1}
                  max={31}
                  {...streamForm.register("paymentDay", { valueAsNumber: true })}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="s-name">
                {streamForm.watch("sourceType") === "SALARY"
                  ? "Company name"
                  : streamForm.watch("sourceType") === "PROJECT"
                    ? "Project name"
                    : "Name (optional)"}
              </Label>
              <Input id="s-name" {...streamForm.register("sourceName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-desc">Description</Label>
              <Input id="s-desc" {...streamForm.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label>Tag</Label>
              <Select
                value={streamForm.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  streamForm.setValue("tagId", v === "__none__" ? "" : v)
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
            <div className="flex items-start gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2.5">
              <Checkbox
                id="s-active"
                checked={streamForm.watch("isActive")}
                onCheckedChange={(c) =>
                  streamForm.setValue("isActive", c === true)
                }
              />
              <div className="grid gap-0.5 leading-snug">
                <Label htmlFor="s-active" className="font-normal">
                  Active
                </Label>
                <p className="text-muted-foreground text-xs">Off: no new rows, no forecast.</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createStreamMut.isPending || updateStreamMut.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recordOpen}
        onOpenChange={(v) => {
          setRecordOpen(v);
          if (!v) setEditingRecord(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit payment record</DialogTitle>
          </DialogHeader>
          {editingRecord ? (
            <form
              className="grid gap-3"
              onSubmit={recordForm.handleSubmit(onRecordSubmit)}
            >
              <p className="text-muted-foreground text-xs">
                {formatDate(editingRecord.scheduledDate)} ·{" "}
                {SOURCE_LABEL[resolveRecordSourceType(editingRecord)]}
                {editingRecord.incomeStreamId ? " · from recurring" : " · manual"}
              </p>
              <div className="grid gap-2">
                <Label htmlFor="r-amount">Amount</Label>
                <Input
                  id="r-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  {...recordForm.register("amount")}
                />
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2.5">
                <Checkbox
                  id="r-received"
                  checked={recordForm.watch("received")}
                  onCheckedChange={(c) =>
                    recordForm.setValue("received", c === true)
                  }
                />
                <div className="grid gap-0.5 leading-snug">
                  <Label htmlFor="r-received" className="font-normal">
                    Received
                  </Label>
                  <p className="text-muted-foreground text-xs">Money in your account.</p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="r-desc">Note</Label>
                <Input id="r-desc" {...recordForm.register("description")} />
              </div>
              <div className="grid gap-2">
                <Label>Tag</Label>
                <Select
                  value={recordForm.watch("tagId") || "__none__"}
                  onValueChange={(v) =>
                    recordForm.setValue("tagId", v === "__none__" ? "" : v)
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
                <Button type="submit" disabled={updateRecordMut.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manual income record</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={manualForm.handleSubmit(onManualSubmit)}
          >
            <div className="grid gap-2">
              <Label htmlFor="m-date">Pay date</Label>
              <Input
                id="m-date"
                type="date"
                {...manualForm.register("scheduledDate")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-amount">Amount</Label>
              <Input
                id="m-amount"
                type="number"
                step="0.01"
                min="0"
                {...manualForm.register("amount")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={manualForm.watch("sourceType")}
                onValueChange={(v) => {
                  const t = v as z.infer<typeof manualSchema>["sourceType"];
                  manualForm.setValue("sourceType", t);
                  if (t === "SALARY") {
                    manualForm.setValue("salaryPaySchedule", "MONTHLY");
                  } else {
                    manualForm.setValue("salaryPaySchedule", undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALARY">Salary</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {manualForm.watch("sourceType") === "SALARY" ? (
              <div className="grid gap-2">
                <Label>Pay schedule</Label>
                <Select
                  value={manualForm.watch("salaryPaySchedule") ?? "MONTHLY"}
                  onValueChange={(v) =>
                    manualForm.setValue(
                      "salaryPaySchedule",
                      v as NonNullable<
                        z.infer<typeof manualSchema>["salaryPaySchedule"]
                      >,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="BI_WEEKLY">Bi-weekly</SelectItem>
                    <SelectItem value="ONE_OFF">One-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="m-name">Name (optional)</Label>
              <Input id="m-name" {...manualForm.register("sourceName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-desc">Description</Label>
              <Input id="m-desc" {...manualForm.register("description")} />
            </div>
            <div className="flex items-start gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2.5">
              <Checkbox
                id="m-received"
                checked={manualForm.watch("received")}
                onCheckedChange={(c) =>
                  manualForm.setValue("received", c === true)
                }
              />
              <div className="grid gap-0.5 leading-snug">
                <Label htmlFor="m-received" className="font-normal">
                  Received
                </Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tag</Label>
              <Select
                value={manualForm.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  manualForm.setValue("tagId", v === "__none__" ? "" : v)
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
              <Button type="submit" disabled={createManualMut.isPending}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
