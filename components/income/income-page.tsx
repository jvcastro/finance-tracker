"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@/lib/zod-resolver"
import {
  IconCalendarMonth,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconDotsVertical,
  IconEye,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import { type ColumnDef } from "@tanstack/react-table"
import { addMonths, format, parseISO, subMonths } from "date-fns"
import { useForm } from "react-hook-form"
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { toast } from "sonner"
import { z } from "zod"

import { DataTable, filterRowsByGlobalFilter } from "@/components/data-table"
import { ResponsiveDetail } from "@/components/responsive-detail"
import {
  TransactionAttachmentDetailPreview,
  TransactionAttachmentFormBlock,
  uploadTransactionAttachment,
} from "@/components/transaction-attachment"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter"
import { formatDate, formatIncomePeriod } from "@/lib/format"
import {
  FINANCIAL_ACCOUNT_KIND_LABEL,
  type FinancialAccountKindValue,
} from "@/lib/financial-account-kind"
import { trpc } from "@/lib/trpc/react"

type IncomeAccountRef = {
  id: string
  name: string
  kind: FinancialAccountKindValue
}

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
    financialAccountId: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate?.trim()) {
      const s = new Date(data.startDate)
      const e = new Date(data.endDate)
      if (e < s) {
        ctx.addIssue({
          code: "custom",
          message: "End date must be on or after the start date.",
          path: ["endDate"],
        })
      }
    }
    if (data.sourceType === "SALARY" && !data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Choose how often your employer pays you.",
        path: ["salaryPaySchedule"],
      })
    }
    if (data.sourceType !== "SALARY" && data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Pay schedule applies only to salary.",
        path: ["salaryPaySchedule"],
      })
    }
    if (
      data.sourceType === "SALARY" &&
      data.salaryPaySchedule === "BI_WEEKLY" &&
      (data.secondPaymentDay == null || Number.isNaN(data.secondPaymentDay))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Add a second payment day (for example, 30).",
        path: ["secondPaymentDay"],
      })
    }
    if (
      data.sourceType === "SALARY" &&
      data.salaryPaySchedule === "BI_WEEKLY" &&
      data.secondPaymentDay != null &&
      data.secondPaymentDay === data.paymentDay
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Use two different days (for example, 15 and 30).",
        path: ["secondPaymentDay"],
      })
    }
  })

type StreamFormValues = z.infer<typeof streamFormSchema>

type StreamRow = {
  id: string
  amount: number
  startDate: Date
  endDate: Date | null
  description: string | null
  sourceType: "SALARY" | "PROJECT" | "OTHER"
  sourceName: string | null
  salaryPaySchedule: "MONTHLY" | "BI_WEEKLY" | "ONE_OFF" | null
  paymentDay: number
  secondPaymentDay: number | null
  isActive: boolean
  tagId: string | null
  tag: { id: string; name: string } | null
  financialAccountId: string | null
  financialAccount: IncomeAccountRef | null
}

const SOURCE_LABEL: Record<StreamRow["sourceType"], string> = {
  SALARY: "Salary",
  PROJECT: "Project",
  OTHER: "Other",
}

const SALARY_SCHEDULE_LABEL: Record<
  NonNullable<StreamRow["salaryPaySchedule"]>,
  string
> = {
  MONTHLY: "Monthly pay",
  BI_WEEKLY: "Bi-weekly pay",
  ONE_OFF: "One-off",
}

const recordEditSchema = z.object({
  amount: z.coerce.number().positive(),
  received: z.boolean(),
  description: z.string().optional(),
  tagId: z.string().optional(),
  financialAccountId: z.string().optional(),
})

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
    financialAccountId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "SALARY" && !data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Choose pay schedule for salary.",
        path: ["salaryPaySchedule"],
      })
    }
    if (data.sourceType !== "SALARY" && data.salaryPaySchedule) {
      ctx.addIssue({
        code: "custom",
        message: "Pay schedule applies only to salary.",
        path: ["salaryPaySchedule"],
      })
    }
  })

type RecordRow = {
  id: string
  incomeStreamId: string | null
  scheduledDate: Date
  amount: number
  received: boolean
  description: string | null
  sourceType: "SALARY" | "PROJECT" | "OTHER" | null
  sourceName: string | null
  salaryPaySchedule: "MONTHLY" | "BI_WEEKLY" | "ONE_OFF" | null
  tag: { id: string; name: string } | null
  financialAccountId: string | null
  financialAccount: IncomeAccountRef | null
  incomeStream: {
    sourceType: string
    sourceName: string | null
    salaryPaySchedule: string | null
  } | null
  attachmentKey: string | null
  attachmentMime: string | null
}

function resolveRecordSourceType(r: RecordRow) {
  return (r.incomeStream?.sourceType ?? r.sourceType ?? "OTHER") as
    | "SALARY"
    | "PROJECT"
    | "OTHER"
}

function recordLabel(r: RecordRow) {
  const fromStream = r.incomeStream?.sourceName?.trim()
  const manual = r.sourceName?.trim()
  if (fromStream) return fromStream
  if (manual) return manual
  return r.description?.trim() || "Income"
}

function formatStreamPayDays(r: StreamRow) {
  if (r.sourceType === "SALARY" && r.salaryPaySchedule === "BI_WEEKLY") {
    const a = r.paymentDay
    const b = r.secondPaymentDay
    if (b != null) return `${a} & ${b}`
  }
  return String(r.paymentDay)
}

const incomeTabValues = ["records", "streams"] as const

export function IncomePage() {
  const fmt = useCurrencyFormatter()
  const utils = trpc.useUtils()

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(incomeTabValues).withDefault("records")
  )
  const [q, setQ] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ throttleMs: 300 })
  )

  const [monthStr, setMonthStr] = React.useState(() =>
    format(new Date(), "yyyy-MM")
  )
  const monthDate = React.useMemo(
    () => parseISO(`${monthStr}-01T12:00:00`),
    [monthStr]
  )

  const { data: records = [], isLoading: loadingRecords } =
    trpc.income.record.list.useQuery({ month: monthDate })
  const { data: streams = [], isLoading: loadingStreams } =
    trpc.income.stream.list.useQuery()

  const createStreamMut = trpc.income.stream.create.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Recurring income saved.")
    },
    onError: (e) => toast.error(e.message),
  })
  const updateStreamMut = trpc.income.stream.update.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Recurring income updated.")
    },
    onError: (e) => toast.error(e.message),
  })
  const deleteStreamMut = trpc.income.stream.delete.useMutation({
    onSuccess: () => {
      void utils.income.stream.list.invalidate()
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Recurring income deleted.")
    },
    onError: (e) => toast.error(e.message),
  })

  const generateMut = trpc.income.record.generateMonth.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Month synced.")
    },
    onError: (e) => toast.error(e.message),
  })

  const createManualMut = trpc.income.record.createManual.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
    },
  })
  const updateRecordMut = trpc.income.record.update.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
    },
  })
  const deleteRecordMut = trpc.income.record.delete.useMutation({
    onSuccess: () => {
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Payment deleted.")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: tags = [] } = trpc.tag.list.useQuery()
  const { data: accounts = [] } = trpc.financialAccount.list.useQuery()

  const filteredRecords = React.useMemo(
    () => filterRowsByGlobalFilter(records as RecordRow[], q),
    [records, q]
  )
  const filteredStreams = React.useMemo(
    () => filterRowsByGlobalFilter(streams as StreamRow[], q),
    [streams, q]
  )

  const [streamOpen, setStreamOpen] = React.useState(false)
  const [editingStream, setEditingStream] = React.useState<StreamRow | null>(
    null
  )

  const [recordOpen, setRecordOpen] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<RecordRow | null>(
    null
  )

  const [manualOpen, setManualOpen] = React.useState(false)

  const [detailRecord, setDetailRecord] = React.useState<RecordRow | null>(null)
  const [detailIncomeStream, setDetailIncomeStream] =
    React.useState<StreamRow | null>(null)
  const [pendingRecordAttachment, setPendingRecordAttachment] =
    React.useState<File | null>(null)
  const [pendingManualAttachment, setPendingManualAttachment] =
    React.useState<File | null>(null)

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
      financialAccountId: "",
      isActive: true,
    },
  })

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
            ? (editingStream.salaryPaySchedule ?? "MONTHLY")
            : undefined,
        paymentDay: editingStream.paymentDay,
        secondPaymentDay: editingStream.secondPaymentDay ?? 30,
        tagId: editingStream.tagId ?? "",
        financialAccountId: editingStream.financialAccountId ?? "",
        isActive: editingStream.isActive,
      })
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
        financialAccountId: "",
        isActive: true,
      })
    }
  }, [editingStream, streamForm, streamOpen])

  const recordForm = useForm<z.infer<typeof recordEditSchema>>({
    resolver: zodResolver(recordEditSchema),
    defaultValues: {
      amount: 0,
      received: false,
      description: "",
      tagId: "",
      financialAccountId: "",
    },
  })

  React.useEffect(() => {
    if (editingRecord) {
      recordForm.reset({
        amount: editingRecord.amount,
        received: editingRecord.received,
        description: editingRecord.description ?? "",
        tagId: editingRecord.tag?.id ?? "",
        financialAccountId: editingRecord.financialAccountId ?? "",
      })
    }
  }, [editingRecord, recordForm, recordOpen])

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
      financialAccountId: "",
    },
  })

  React.useEffect(() => {
    if (manualOpen) {
      manualForm.setValue("scheduledDate", `${monthStr}-01`)
    }
  }, [manualOpen, monthStr, manualForm])

  function onStreamSubmit(values: StreamFormValues) {
    const isBiWeekly =
      values.sourceType === "SALARY" && values.salaryPaySchedule === "BI_WEEKLY"
    const payload = {
      amount: values.amount,
      startDate: new Date(values.startDate),
      endDate: values.endDate?.trim() ? new Date(values.endDate) : null,
      description: values.description || undefined,
      sourceType: values.sourceType,
      sourceName: values.sourceName?.trim() || null,
      salaryPaySchedule:
        values.sourceType === "SALARY"
          ? (values.salaryPaySchedule ?? "MONTHLY")
          : null,
      paymentDay: values.paymentDay,
      secondPaymentDay: isBiWeekly ? (values.secondPaymentDay ?? null) : null,
      tagId: values.tagId || null,
      financialAccountId: values.financialAccountId || null,
      isActive: values.isActive,
    }
    if (editingStream) {
      updateStreamMut.mutate({ id: editingStream.id, ...payload })
    } else {
      createStreamMut.mutate(payload)
    }
    setStreamOpen(false)
    setEditingStream(null)
  }

  async function onRecordSubmit(values: z.infer<typeof recordEditSchema>) {
    if (!editingRecord) return
    try {
      await updateRecordMut.mutateAsync({
        id: editingRecord.id,
        amount: values.amount,
        received: values.received,
        description: values.description || null,
        tagId: values.tagId || null,
        financialAccountId: values.financialAccountId || null,
      })
      if (pendingRecordAttachment) {
        await uploadTransactionAttachment(
          "income",
          editingRecord.id,
          pendingRecordAttachment
        )
      }
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Payment updated.")
      setPendingRecordAttachment(null)
      setRecordOpen(false)
      setEditingRecord(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.")
    }
  }

  async function onManualSubmit(values: z.infer<typeof manualSchema>) {
    const scheduledDate = new Date(`${values.scheduledDate}T12:00:00`)
    try {
      const created = await createManualMut.mutateAsync({
        scheduledDate,
        amount: values.amount,
        sourceType: values.sourceType,
        sourceName: values.sourceName?.trim() || null,
        salaryPaySchedule:
          values.sourceType === "SALARY"
            ? (values.salaryPaySchedule ?? "MONTHLY")
            : null,
        description: values.description || undefined,
        received: values.received,
        tagId: values.tagId || null,
        financialAccountId: values.financialAccountId || null,
      })
      if (pendingManualAttachment) {
        await uploadTransactionAttachment(
          "income",
          created.id,
          pendingManualAttachment
        )
      }
      void utils.income.record.list.invalidate()
      void utils.dashboard.summary.invalidate()
      toast.success("Payment added.")
      setPendingManualAttachment(null)
      setManualOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.")
    }
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
        const r = row.original
        if (r.sourceType !== "SALARY" || !r.salaryPaySchedule) return "—"
        return SALARY_SCHEDULE_LABEL[r.salaryPaySchedule]
      },
    },
    {
      id: "payDays",
      header: "Payment days",
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
      id: "financialAccount",
      header: "Account",
      meta: { className: "hidden lg:table-cell min-w-[10rem]" },
      cell: ({ row }) => {
        const fa = row.original.financialAccount
        if (!fa) return "—"
        return (
          <span className="text-sm">
            <span>{fa.name}</span>
            <span className="ml-1 text-xs text-muted-foreground">
              ({FINANCIAL_ACCOUNT_KIND_LABEL[fa.kind]})
            </span>
          </span>
        )
      },
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount ({fmt.symbol})</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium text-chart-2 tabular-nums">
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
            <DropdownMenuItem onClick={() => setDetailIncomeStream(row.original)}>
              <IconEye className="size-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditingStream(row.original)
                setStreamOpen(true)
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
  ]

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
        <div className="max-w-[14rem] truncate font-medium">
          {recordLabel(row.original)}
        </div>
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
      id: "financialAccount",
      header: "Account",
      meta: { className: "hidden lg:table-cell min-w-[10rem]" },
      cell: ({ row }) => {
        const fa = row.original.financialAccount
        if (!fa) return "—"
        return (
          <span className="text-sm">
            <span>{fa.name}</span>
            <span className="ml-1 text-xs text-muted-foreground">
              ({FINANCIAL_ACCOUNT_KIND_LABEL[fa.kind]})
            </span>
          </span>
        )
      },
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
      header: () => <div className="text-right">Amount ({fmt.symbol})</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium text-chart-2 tabular-nums">
          {fmt(row.original.amount)}
        </div>
      ),
    },
    {
      id: "attachment",
      header: () => <span className="sr-only">Receipt</span>,
      meta: { className: "w-9 px-0 text-center" },
      cell: ({ row }) =>
        row.original.attachmentKey ? (
          <span title="Has receipt or invoice">
            <IconPaperclip
              className="mx-auto size-4 text-muted-foreground"
              aria-hidden
            />
          </span>
        ) : (
          <span className="text-muted-foreground/25">—</span>
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
            <DropdownMenuItem onClick={() => setDetailRecord(row.original)}>
              <IconEye className="size-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={updateRecordMut.isPending}
              onClick={() => {
                const r = row.original
                updateRecordMut.mutate({
                  id: r.id,
                  received: !r.received,
                  description: r.description,
                  tagId: r.tag?.id ?? null,
                  financialAccountId: r.financialAccountId ?? null,
                })
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
                setEditingRecord(row.original)
                setRecordOpen(true)
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
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">Recurring</span> is your expected
            pay schedule.{" "}
            <span className="text-foreground">Payment records</span> list pay
            dates (filled automatically). Mark as received when the deposit
            clears.
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          void setTab(v as (typeof incomeTabValues)[number])
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="records">Payment records</TabsTrigger>
          <TabsTrigger value="streams">Recurring</TabsTrigger>
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
                    setMonthStr((m) =>
                      format(subMonths(parseISO(`${m}-01`), 1), "yyyy-MM")
                    )
                  }
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <IconCalendarMonth
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
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
                    setMonthStr((m) =>
                      format(addMonths(parseISO(`${m}-01`), 1), "yyyy-MM")
                    )
                  }
                >
                  <IconChevronRight className="size-4" />
                </Button>
                <Button
                  variant="secondary"
                  disabled={generateMut.isPending}
                  onClick={() => generateMut.mutate({ month: monthDate })}
                  title="Create any missing payment rows for this month"
                >
                  Sync month
                </Button>
              </div>
              <Button
                onClick={() => {
                  setManualOpen(true)
                }}
              >
                <IconPlus className="size-4" />
                Add manual payment
              </Button>
            </div>

            {loadingRecords ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <Input
                  type="search"
                  placeholder="Search…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="max-w-sm"
                  aria-label="Search payment records"
                />
                <div className="hidden sm:block">
                  <DataTable
                    columns={recordColumns}
                    data={records as RecordRow[]}
                    mobileScrollHint="Swipe sideways to see all columns."
                    globalFilter={q}
                    onGlobalFilterChange={setQ}
                    hideFilterInput
                    onRowClick={(row) => setDetailRecord(row)}
                  />
                </div>
                <div className="space-y-2 sm:hidden">
                  {filteredRecords.length === 0 ? (
                    <div className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
                      {Boolean(q.trim()) && records.length > 0
                        ? "No rows match your filter."
                        : "No rows yet."}
                    </div>
                  ) : (
                    filteredRecords.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-stretch gap-1 rounded-lg border border-border/80 bg-card shadow-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted/70"
                          onClick={() => setDetailRecord(row)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 leading-snug font-medium text-foreground">
                                {recordLabel(row)}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {row.received ? (
                                  <Badge
                                    variant="secondary"
                                    className="font-normal"
                                  >
                                    Received
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
                                  {formatDate(row.scheduledDate)}
                                  {row.financialAccount
                                    ? ` · ${row.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[row.financialAccount.kind]})`
                                    : ""}
                                </span>
                              </p>
                            </div>
                            <span className="flex shrink-0 items-start gap-1.5">
                              {row.attachmentKey ? (
                                <IconPaperclip
                                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                  title="Has receipt or invoice"
                                />
                              ) : null}
                              <span className="font-semibold text-chart-2 tabular-nums">
                                {fmt(row.amount)}
                              </span>
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
                            <DropdownMenuItem onClick={() => setDetailRecord(row)}>
                              <IconEye className="size-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={updateRecordMut.isPending}
                              onClick={() => {
                                updateRecordMut.mutate({
                                  id: row.id,
                                  received: !row.received,
                                  description: row.description,
                                  tagId: row.tag?.id ?? null,
                                  financialAccountId:
                                    row.financialAccountId ?? null,
                                })
                              }}
                            >
                              {row.received ? (
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
                                setEditingRecord(row)
                                setRecordOpen(true)
                              }}
                            >
                              <IconPencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                deleteRecordMut.mutate({ id: row.id })
                              }
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
          </div>
        </TabsContent>

        <TabsContent value="streams" className="mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingStream(null)
                  setStreamOpen(true)
                }}
              >
                <IconPlus className="size-4" />
                Add recurring income
              </Button>
            </div>
            {loadingStreams ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <Input
                  type="search"
                  placeholder="Search…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="max-w-sm"
                  aria-label="Search recurring income"
                />
                <div className="hidden sm:block">
                  <DataTable
                    columns={streamColumns}
                    data={streams as StreamRow[]}
                    mobileScrollHint="Swipe sideways to see all columns."
                    globalFilter={q}
                    onGlobalFilterChange={setQ}
                    hideFilterInput
                    onRowClick={(row) => setDetailIncomeStream(row)}
                  />
                </div>
                <div className="space-y-2 sm:hidden">
                  {filteredStreams.length === 0 ? (
                    <div className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
                      {Boolean(q.trim()) && streams.length > 0
                        ? "No rows match your filter."
                        : "No rows yet."}
                    </div>
                  ) : (
                    filteredStreams.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-stretch gap-1 rounded-lg border border-border/80 bg-card shadow-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted/70"
                          onClick={() => setDetailIncomeStream(row)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 leading-snug font-medium text-foreground">
                                {row.sourceName?.trim() ||
                                  row.description?.trim() ||
                                  SOURCE_LABEL[row.sourceType]}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {SOURCE_LABEL[row.sourceType]}
                                {" · "}
                                {formatIncomePeriod(row.startDate, row.endDate)}
                                {row.financialAccount
                                  ? ` · ${row.financialAccount.name}`
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold text-chart-2 tabular-nums">
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
                              onClick={() => setDetailIncomeStream(row)}
                            >
                              <IconEye className="size-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingStream(row)
                                setStreamOpen(true)
                              }}
                            >
                              <IconPencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                deleteStreamMut.mutate({ id: row.id })
                              }
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
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={streamOpen}
        onOpenChange={(v) => {
          setStreamOpen(v)
          if (!v) setEditingStream(null)
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
              <Label htmlFor="s-amount">Amount ({fmt.symbol})</Label>
              <p className="-mt-1 text-xs text-muted-foreground">
                Gross per month, or per paycheck if you are paid biweekly.
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
                  const t = v as StreamFormValues["sourceType"]
                  streamForm.setValue("sourceType", t)
                  if (t === "SALARY") {
                    streamForm.setValue("salaryPaySchedule", "MONTHLY")
                  } else {
                    streamForm.setValue("salaryPaySchedule", undefined)
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
                <Label htmlFor="s-payday">Day of month</Label>
                <p className="-mt-1 text-xs text-muted-foreground">
                  1–31 (short months use the last day).
                </p>
                <Input
                  id="s-payday"
                  type="number"
                  min={1}
                  max={31}
                  {...streamForm.register("paymentDay", {
                    valueAsNumber: true,
                  })}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="s-start">Start date</Label>
              <Input
                id="s-start"
                type="date"
                {...streamForm.register("startDate")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-end">End date (optional)</Label>
              <Input
                id="s-end"
                type="date"
                {...streamForm.register("endDate")}
              />
            </div>
            {streamForm.watch("sourceType") === "SALARY" ? (
              <div className="grid gap-2">
                <Label>Pay schedule</Label>
                <Select
                  value={streamForm.watch("salaryPaySchedule") ?? "MONTHLY"}
                  onValueChange={(v) => {
                    const sch = v as StreamFormValues["salaryPaySchedule"]
                    streamForm.setValue("salaryPaySchedule", sch)
                    if (sch === "BI_WEEKLY") {
                      streamForm.setValue("paymentDay", 15)
                      streamForm.setValue("secondPaymentDay", 30)
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
                  <Label htmlFor="s-pay1">First payment day</Label>
                  <Input
                    id="s-pay1"
                    type="number"
                    min={1}
                    max={31}
                    {...streamForm.register("paymentDay", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="s-pay2">Second payment day</Label>
                  <Input
                    id="s-pay2"
                    type="number"
                    min={1}
                    max={31}
                    {...streamForm.register("secondPaymentDay", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            ) : streamForm.watch("sourceType") === "SALARY" ? (
              <div className="grid gap-2">
                <Label htmlFor="s-payday-salary">Day of month</Label>
                <p className="-mt-1 text-xs text-muted-foreground">
                  1–31. One-off: first on or after the start date.
                </p>
                <Input
                  id="s-payday-salary"
                  type="number"
                  min={1}
                  max={31}
                  {...streamForm.register("paymentDay", {
                    valueAsNumber: true,
                  })}
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
              <Label htmlFor="s-desc">Description (optional)</Label>
              <Input id="s-desc" {...streamForm.register("description")} />
            </div>
            <div className="grid gap-2">
              <Label>Tag (optional)</Label>
              <Select
                value={streamForm.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  streamForm.setValue("tagId", v === "__none__" ? "" : v)
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
                value={streamForm.watch("financialAccountId") || "__none__"}
                onValueChange={(v) =>
                  streamForm.setValue(
                    "financialAccountId",
                    v === "__none__" ? "" : v
                  )
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
              <p className="text-xs text-muted-foreground">
                Add or manage accounts in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
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
                <p className="text-xs text-muted-foreground">
                  When off, no new payment rows or forecast amounts.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  createStreamMut.isPending || updateStreamMut.isPending
                }
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
          setRecordOpen(v)
          if (!v) {
            setEditingRecord(null)
            setPendingRecordAttachment(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit payment</DialogTitle>
          </DialogHeader>
          {editingRecord ? (
            <form
              className="grid gap-3"
              onSubmit={recordForm.handleSubmit(onRecordSubmit)}
            >
              <p className="text-xs text-muted-foreground">
                {formatDate(editingRecord.scheduledDate)} ·{" "}
                {SOURCE_LABEL[resolveRecordSourceType(editingRecord)]}
                {editingRecord.incomeStreamId ? " · Recurring" : " · Manual"}
              </p>
              <div className="grid gap-2">
                <Label htmlFor="r-amount">Amount ({fmt.symbol})</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Turn on when the funds have cleared in your account.
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="r-desc">Description (optional)</Label>
                <Input id="r-desc" {...recordForm.register("description")} />
              </div>
              <div className="grid gap-2">
                <Label>Tag (optional)</Label>
                <Select
                  value={recordForm.watch("tagId") || "__none__"}
                  onValueChange={(v) =>
                    recordForm.setValue("tagId", v === "__none__" ? "" : v)
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
                  value={recordForm.watch("financialAccountId") || "__none__"}
                  onValueChange={(v) =>
                    recordForm.setValue(
                      "financialAccountId",
                      v === "__none__" ? "" : v
                    )
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
                <p className="text-xs text-muted-foreground">
                  Add or manage accounts in{" "}
                  <Link
                    href="/settings"
                    className="underline underline-offset-2"
                  >
                    Settings
                  </Link>
                  .
                </p>
              </div>
              <TransactionAttachmentFormBlock
                entity="income"
                recordId={editingRecord.id}
                attachmentKey={editingRecord.attachmentKey}
                attachmentMime={editingRecord.attachmentMime}
                pendingFile={pendingRecordAttachment}
                onPendingFileChange={setPendingRecordAttachment}
                onAttachmentRemoved={() =>
                  setEditingRecord((r) =>
                    r
                      ? { ...r, attachmentKey: null, attachmentMime: null }
                      : r
                  )
                }
                disabled={updateRecordMut.isPending}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateRecordMut.isPending}
                >
                  Save
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={manualOpen}
        onOpenChange={(v) => {
          setManualOpen(v)
          if (!v) setPendingManualAttachment(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add manual payment</DialogTitle>
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
              <Label htmlFor="m-amount">Amount ({fmt.symbol})</Label>
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
                  const t = v as z.infer<typeof manualSchema>["sourceType"]
                  manualForm.setValue("sourceType", t)
                  if (t === "SALARY") {
                    manualForm.setValue("salaryPaySchedule", "MONTHLY")
                  } else {
                    manualForm.setValue("salaryPaySchedule", undefined)
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
                      >
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
              <Label htmlFor="m-desc">Description (optional)</Label>
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
              <Label>Tag (optional)</Label>
              <Select
                value={manualForm.watch("tagId") || "__none__"}
                onValueChange={(v) =>
                  manualForm.setValue("tagId", v === "__none__" ? "" : v)
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
                value={manualForm.watch("financialAccountId") || "__none__"}
                onValueChange={(v) =>
                  manualForm.setValue(
                    "financialAccountId",
                    v === "__none__" ? "" : v
                  )
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
              <p className="text-xs text-muted-foreground">
                Add or manage accounts in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
            </div>
            <TransactionAttachmentFormBlock
              entity="income"
              recordId={null}
              attachmentKey={null}
              attachmentMime={null}
              pendingFile={pendingManualAttachment}
              onPendingFileChange={setPendingManualAttachment}
              disabled={createManualMut.isPending}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={createManualMut.isPending}
              >
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ResponsiveDetail
        open={detailRecord != null}
        onOpenChange={(v) => {
          if (!v) setDetailRecord(null)
        }}
        title={
          detailRecord ? recordLabel(detailRecord) : "Payment"
        }
        description="View payment details. Use Edit to change this record."
        footer={
          detailRecord ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="default"
                className="min-w-0"
                disabled={updateRecordMut.isPending}
                onClick={() => {
                  const r = detailRecord
                  if (!r) return
                  updateRecordMut.mutate(
                    {
                      id: r.id,
                      received: !r.received,
                      description: r.description,
                      tagId: r.tag?.id ?? null,
                      financialAccountId: r.financialAccountId ?? null,
                    },
                    {
                      onSuccess: () => {
                        setDetailRecord((d) =>
                          d && d.id === r.id
                            ? { ...d, received: !d.received }
                            : d
                        )
                      },
                    }
                  )
                }}
              >
                {detailRecord.received ? (
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
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-w-0"
                onClick={() => {
                  const r = detailRecord
                  setDetailRecord(null)
                  setEditingRecord(r)
                  setRecordOpen(true)
                }}
              >
                <IconPencil className="size-4" />
                Edit
              </Button>
            </div>
          ) : null
        }
      >
        {detailRecord ? (
          <div className="space-y-0 text-sm text-foreground">
            <TransactionAttachmentDetailPreview
              entity="income"
              recordId={detailRecord.id}
              hasAttachment={Boolean(detailRecord.attachmentKey)}
            />
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-chart-2 tabular-nums">
                {fmt(detailRecord.amount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Pay date</span>
              <span>{formatDate(detailRecord.scheduledDate)}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Kind</span>
              <span>
                {detailRecord.incomeStreamId ? "Recurring" : "Manual"}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Type</span>
              <span>
                {SOURCE_LABEL[resolveRecordSourceType(detailRecord)]}
              </span>
            </div>
            {resolveRecordSourceType(detailRecord) === "SALARY" &&
            detailRecord.salaryPaySchedule ? (
              <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                <span className="text-muted-foreground">Salary pay</span>
                <span className="text-right">
                  {SALARY_SCHEDULE_LABEL[detailRecord.salaryPaySchedule]}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Status</span>
              <span>{detailRecord.received ? "Received" : "Pending"}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Tag</span>
              <span className="text-right">
                {detailRecord.tag?.name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Account</span>
              <span className="text-right">
                {detailRecord.financialAccount
                  ? `${detailRecord.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[detailRecord.financialAccount.kind]})`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <span className="text-muted-foreground">Description</span>
              <span className="text-right">
                {detailRecord.description?.trim() || "—"}
              </span>
            </div>
          </div>
        ) : null}
      </ResponsiveDetail>

      <ResponsiveDetail
        open={detailIncomeStream != null}
        onOpenChange={(v) => {
          if (!v) setDetailIncomeStream(null)
        }}
        title={
          detailIncomeStream
            ? detailIncomeStream.sourceName?.trim() ||
              detailIncomeStream.description?.trim() ||
              SOURCE_LABEL[detailIncomeStream.sourceType]
            : "Recurring income"
        }
        description="View recurring income details. Use Edit to change this stream."
        footer={
          detailIncomeStream ? (
            <Button
              className="w-full"
              onClick={() => {
                const r = detailIncomeStream
                setDetailIncomeStream(null)
                setEditingStream(r)
                setStreamOpen(true)
              }}
            >
              <IconPencil className="size-4" />
              Edit
            </Button>
          ) : null
        }
      >
        {detailIncomeStream ? (
          <div className="space-y-0 text-sm text-foreground">
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-chart-2 tabular-nums">
                {fmt(detailIncomeStream.amount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Source</span>
              <span>{SOURCE_LABEL[detailIncomeStream.sourceType]}</span>
            </div>
            {detailIncomeStream.sourceType === "SALARY" &&
            detailIncomeStream.salaryPaySchedule ? (
              <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                <span className="text-muted-foreground">Salary pay</span>
                <span className="text-right">
                  {
                    SALARY_SCHEDULE_LABEL[
                      detailIncomeStream.salaryPaySchedule
                    ]
                  }
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Payment days</span>
              <span className="text-right">
                {formatStreamPayDays(detailIncomeStream)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Active period</span>
              <span className="text-right">
                {formatIncomePeriod(
                  detailIncomeStream.startDate,
                  detailIncomeStream.endDate
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Tag</span>
              <span className="text-right">
                {detailIncomeStream.tag?.name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Account</span>
              <span className="text-right">
                {detailIncomeStream.financialAccount
                  ? `${detailIncomeStream.financialAccount.name} (${FINANCIAL_ACCOUNT_KIND_LABEL[detailIncomeStream.financialAccount.kind]})`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
              <span className="text-muted-foreground">Description</span>
              <span className="text-right">
                {detailIncomeStream.description?.trim() || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <span className="text-muted-foreground">Active</span>
              <span>{detailIncomeStream.isActive ? "Yes" : "Off"}</span>
            </div>
          </div>
        ) : null}
      </ResponsiveDetail>
    </div>
  )
}
