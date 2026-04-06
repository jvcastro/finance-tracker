import { TRPCError } from "@trpc/server"
import { endOfMonth, startOfMonth } from "date-fns"
import { z } from "zod"

import { Prisma, type PrismaClient } from "@/generated/prisma/client"
import {
  ensureExpenseRecordsForMonth,
  ensureExpenseRecordsRollingWindow,
} from "@/lib/expense-ensure"
import { deleteR2Object } from "@/lib/r2"
import { router, protectedProcedure } from "@/server/trpc"

async function assertTag(
  prisma: PrismaClient,
  userId: string,
  tagId: string | null | undefined
) {
  if (!tagId) return
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId },
  })
  if (!tag) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tag." })
  }
}

async function assertFinancialAccount(
  prisma: PrismaClient,
  userId: string,
  financialAccountId: string | null | undefined
) {
  if (!financialAccountId) return
  const fa = await prisma.financialAccount.findFirst({
    where: { id: financialAccountId, userId },
  })
  if (!fa) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid account." })
  }
}

const expensePaymentMethodSchema = z.enum([
  "MANUAL",
  "BANK_AUTO_DEBIT",
  "CARD_AUTO_PAY",
])

const streamFields = z.object({
  amount: z.number().positive(),
  description: z.string().max(500).optional().nullable(),
  tagId: z.string().optional().nullable(),
  financialAccountId: z.string().optional().nullable(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  paymentDay: z.number().int().min(1).max(31),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
})

function streamRefine(
  data: z.infer<typeof streamFields>,
  ctx: z.RefinementCtx
) {
  const end = data.endDate ?? null
  if (end != null && end < data.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    })
  }
}

const streamCreateInput = streamFields.superRefine(streamRefine)
const streamUpdateInput = streamFields
  .extend({ id: z.string() })
  .superRefine(streamRefine)

const financialAccountSelect = {
  id: true,
  name: true,
  kind: true,
} as const

/** Narrow relation payloads (avoid `include` loading full nested models). */
const expenseWithRelationsSelect = {
  id: true,
  userId: true,
  amount: true,
  date: true,
  description: true,
  tagId: true,
  expenseStreamId: true,
  financialAccountId: true,
  paymentMethod: true,
  paid: true,
  attachmentKey: true,
  attachmentMime: true,
  createdAt: true,
  tag: { select: { id: true, name: true } },
  financialAccount: { select: financialAccountSelect },
  expenseStream: { select: { id: true } },
} satisfies Prisma.ExpenseSelect

const expenseStreamWithRelationsSelect = {
  id: true,
  userId: true,
  amount: true,
  description: true,
  tagId: true,
  financialAccountId: true,
  paymentMethod: true,
  paymentDay: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  tag: { select: { id: true, name: true } },
  financialAccount: { select: financialAccountSelect },
} satisfies Prisma.ExpenseStreamSelect

export const expenseRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          month: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      const month = input?.month

      if (month != null) {
        await ensureExpenseRecordsRollingWindow(ctx.prisma, userId)
        await ensureExpenseRecordsForMonth(ctx.prisma, userId, month)
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(monthStart)
        const rows = await ctx.prisma.expense.findMany({
          where: {
            userId,
            date: { gte: monthStart, lte: monthEnd },
          },
          orderBy: [{ date: "desc" }, { paid: "asc" }, { createdAt: "desc" }],
          select: expenseWithRelationsSelect,
        })
        return rows.map((r) => ({
          ...r,
          amount: Number(r.amount),
        }))
      }

      const rows = await ctx.prisma.expense.findMany({
        where: { userId },
        orderBy: [{ date: "desc" }, { paid: "asc" }, { createdAt: "desc" }],
        select: expenseWithRelationsSelect,
      })
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }))
    }),

  generateMonth: protectedProcedure
    .input(z.object({ month: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      await ensureExpenseRecordsForMonth(ctx.prisma, userId, input.month)
    }),

  create: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        date: z.coerce.date(),
        description: z.string().max(500).optional(),
        tagId: z.string().optional().nullable(),
        financialAccountId: z.string().optional().nullable(),
        paymentMethod: expensePaymentMethodSchema.optional(),
        paid: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      await assertTag(ctx.prisma, userId, input.tagId)
      await assertFinancialAccount(ctx.prisma, userId, input.financialAccountId)
      const row = await ctx.prisma.expense.create({
        data: {
          userId,
          amount: input.amount,
          date: input.date,
          description: input.description,
          tagId: input.tagId ?? undefined,
          financialAccountId: input.financialAccountId ?? undefined,
          paymentMethod: input.paymentMethod ?? "MANUAL",
          paid: input.paid ?? false,
        },
        select: expenseWithRelationsSelect,
      })
      return { ...row, amount: Number(row.amount) }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        amount: z.number().positive(),
        date: z.coerce.date(),
        description: z.string().max(500).optional().nullable(),
        tagId: z.string().optional().nullable(),
        financialAccountId: z.string().optional().nullable(),
        paymentMethod: expensePaymentMethodSchema,
        paid: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, userId },
      })
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      await assertTag(ctx.prisma, userId, input.tagId)
      await assertFinancialAccount(ctx.prisma, userId, input.financialAccountId)
      const row = await ctx.prisma.expense.update({
        where: { id: input.id },
        data: {
          amount: input.amount,
          date: input.date,
          description: input.description,
          tagId: input.tagId ?? undefined,
          financialAccountId: input.financialAccountId ?? undefined,
          paymentMethod: input.paymentMethod,
          paid: input.paid,
        },
        select: expenseWithRelationsSelect,
      })
      return { ...row, amount: Number(row.amount) }
    }),

  setPaid: protectedProcedure
    .input(z.object({ id: z.string(), paid: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, userId },
      })
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      const row = await ctx.prisma.expense.update({
        where: { id: input.id },
        data: { paid: input.paid },
        select: expenseWithRelationsSelect,
      })
      return { ...row, amount: Number(row.amount) }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, userId },
      })
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (existing.attachmentKey) {
        await deleteR2Object(existing.attachmentKey)
      }
      await ctx.prisma.expense.delete({ where: { id: input.id } })
    }),

  stream: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.session!.user!.id
      const rows = await ctx.prisma.expenseStream.findMany({
        where: { userId },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: expenseStreamWithRelationsSelect,
      })
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }))
    }),

    create: protectedProcedure
      .input(streamCreateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id
        await assertTag(ctx.prisma, userId, input.tagId)
        await assertFinancialAccount(
          ctx.prisma,
          userId,
          input.financialAccountId
        )
        const row = await ctx.prisma.expenseStream.create({
          data: {
            userId,
            amount: input.amount,
            description: input.description,
            tagId: input.tagId ?? undefined,
            financialAccountId: input.financialAccountId ?? undefined,
            paymentMethod: input.paymentMethod ?? "MANUAL",
            paymentDay: input.paymentDay,
            startDate: input.startDate,
            endDate: input.endDate ?? undefined,
            isActive: input.isActive ?? true,
          },
          select: expenseStreamWithRelationsSelect,
        })
        return { ...row, amount: Number(row.amount) }
      }),

    update: protectedProcedure
      .input(streamUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id
        const existing = await ctx.prisma.expenseStream.findFirst({
          where: { id: input.id, userId },
        })
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" })
        }
        await assertTag(ctx.prisma, userId, input.tagId)
        await assertFinancialAccount(
          ctx.prisma,
          userId,
          input.financialAccountId
        )
        const row = await ctx.prisma.expenseStream.update({
          where: { id: input.id },
          data: {
            amount: input.amount,
            description: input.description,
            tagId: input.tagId ?? undefined,
            financialAccountId: input.financialAccountId ?? undefined,
            paymentMethod: input.paymentMethod ?? existing.paymentMethod,
            paymentDay: input.paymentDay,
            startDate: input.startDate,
            endDate: input.endDate ?? undefined,
            isActive: input.isActive ?? existing.isActive,
          },
          select: expenseStreamWithRelationsSelect,
        })
        return { ...row, amount: Number(row.amount) }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id
        const existing = await ctx.prisma.expenseStream.findFirst({
          where: { id: input.id, userId },
        })
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" })
        }
        await ctx.prisma.expenseStream.delete({ where: { id: input.id } })
      }),
  }),
})
