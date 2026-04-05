import { TRPCError } from "@trpc/server";
import { endOfMonth, startOfMonth } from "date-fns";
import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { atNoonLocal } from "@/lib/income-schedule";
import {
  ensureIncomeRecordsForMonth,
  ensureIncomeRecordsRollingWindow,
} from "@/lib/income-ensure";
import { router, protectedProcedure } from "@/server/trpc";

const incomeSourceTypeSchema = z.enum(["SALARY", "PROJECT", "OTHER"]);
const salaryPayScheduleSchema = z.enum(["MONTHLY", "BI_WEEKLY", "ONE_OFF"]);

const streamFields = z.object({
  amount: z.number().positive(),
  sourceType: incomeSourceTypeSchema,
  sourceName: z.string().max(200).optional().nullable(),
  salaryPaySchedule: salaryPayScheduleSchema.nullable(),
  paymentDay: z.number().int().min(1).max(31),
  secondPaymentDay: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  description: z.string().max(500).optional().nullable(),
  tagId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function streamRefine(
  data: z.infer<typeof streamFields>,
  ctx: z.RefinementCtx,
) {
  const end = data.endDate ?? null;
  if (end != null && end < data.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    });
  }
  if (data.sourceType === "SALARY" && data.salaryPaySchedule == null) {
    ctx.addIssue({
      code: "custom",
      message:
        "Select how often your employer pays you (monthly, bi-weekly, or one-off).",
      path: ["salaryPaySchedule"],
    });
  }
  if (data.sourceType !== "SALARY" && data.salaryPaySchedule != null) {
    ctx.addIssue({
      code: "custom",
      message: "Pay schedule applies only to company salary.",
      path: ["salaryPaySchedule"],
    });
  }
  if (
    data.sourceType === "SALARY" &&
    data.salaryPaySchedule === "BI_WEEKLY" &&
    data.secondPaymentDay == null
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Bi-weekly pay needs a second day of the month (e.g. 30).",
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
      message: "Use two different days for each pay (e.g. 15 and 30).",
      path: ["secondPaymentDay"],
    });
  }
}

const streamCreateInput = streamFields.superRefine(streamRefine);
const streamUpdateInput = streamFields
  .extend({ id: z.string() })
  .superRefine(streamRefine);

const manualCreateInput = z
  .object({
    scheduledDate: z.coerce.date(),
    amount: z.number().positive(),
    sourceType: incomeSourceTypeSchema,
    sourceName: z.string().max(200).optional().nullable(),
    salaryPaySchedule: salaryPayScheduleSchema.nullable(),
    description: z.string().max(500).optional().nullable(),
    received: z.boolean(),
    tagId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "SALARY" && data.salaryPaySchedule == null) {
      ctx.addIssue({
        code: "custom",
        message: "Select pay schedule for salary.",
        path: ["salaryPaySchedule"],
      });
    }
    if (data.sourceType !== "SALARY" && data.salaryPaySchedule != null) {
      ctx.addIssue({
        code: "custom",
        message: "Pay schedule applies only to company salary.",
        path: ["salaryPaySchedule"],
      });
    }
  });

const recordUpdateInput = z.object({
  id: z.string(),
  amount: z.number().positive().optional(),
  received: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
  tagId: z.string().optional().nullable(),
});

async function assertTag(
  prisma: PrismaClient,
  userId: string,
  tagId: string | null | undefined,
) {
  if (!tagId) return;
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId },
  });
  if (!tag) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tag." });
  }
}

export const incomeRouter = router({
  stream: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.session!.user!.id;
      const rows = await ctx.prisma.incomeStream.findMany({
        where: { userId },
        orderBy: { startDate: "desc" },
        include: { tag: true },
      });
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));
    }),
    create: protectedProcedure
      .input(streamCreateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        await assertTag(ctx.prisma, userId, input.tagId);
        const row = await ctx.prisma.incomeStream.create({
          data: {
            userId,
            amount: input.amount,
            sourceType: input.sourceType,
            sourceName: input.sourceName?.trim() || null,
            salaryPaySchedule:
              input.sourceType === "SALARY" ? input.salaryPaySchedule : null,
            paymentDay: input.paymentDay,
            secondPaymentDay:
              input.sourceType === "SALARY" &&
              input.salaryPaySchedule === "BI_WEEKLY"
                ? input.secondPaymentDay ?? null
                : null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            description: input.description,
            tagId: input.tagId ?? undefined,
            isActive: input.isActive ?? true,
          },
          include: { tag: true },
        });
        await ensureIncomeRecordsRollingWindow(ctx.prisma, userId);
        return { ...row, amount: Number(row.amount) };
      }),
    update: protectedProcedure
      .input(streamUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        const existing = await ctx.prisma.incomeStream.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await assertTag(ctx.prisma, userId, input.tagId);
        const row = await ctx.prisma.incomeStream.update({
          where: { id: input.id },
          data: {
            amount: input.amount,
            sourceType: input.sourceType,
            sourceName: input.sourceName?.trim() || null,
            salaryPaySchedule:
              input.sourceType === "SALARY" ? input.salaryPaySchedule : null,
            paymentDay: input.paymentDay,
            secondPaymentDay:
              input.sourceType === "SALARY" &&
              input.salaryPaySchedule === "BI_WEEKLY"
                ? input.secondPaymentDay ?? null
                : null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            description: input.description,
            tagId: input.tagId ?? undefined,
            isActive: input.isActive ?? true,
          },
          include: { tag: true },
        });
        await ensureIncomeRecordsRollingWindow(ctx.prisma, userId);
        return { ...row, amount: Number(row.amount) };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        const existing = await ctx.prisma.incomeStream.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await ctx.prisma.incomeStream.delete({ where: { id: input.id } });
      }),
  }),

  record: router({
    list: protectedProcedure
      .input(
        z
          .object({
            month: z.coerce.date().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        const month = input?.month ?? new Date();
        const monthStart = startOfMonth(month);
        await ensureIncomeRecordsRollingWindow(ctx.prisma, userId);
        await ensureIncomeRecordsForMonth(ctx.prisma, userId, month);

        const monthEnd = endOfMonth(monthStart);
        const rows = await ctx.prisma.income.findMany({
          where: {
            userId,
            scheduledDate: { gte: monthStart, lte: monthEnd },
          },
          orderBy: [{ scheduledDate: "asc" }, { received: "asc" }],
          include: { tag: true, incomeStream: true },
        });
        return rows.map((r) => ({
          ...r,
          amount: Number(r.amount),
        }));
      }),

    generateMonth: protectedProcedure
      .input(z.object({ month: z.coerce.date() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        await ensureIncomeRecordsForMonth(ctx.prisma, userId, input.month);
      }),

    createManual: protectedProcedure
      .input(manualCreateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        await assertTag(ctx.prisma, userId, input.tagId);
        const scheduledDate = atNoonLocal(input.scheduledDate);
        const existingManual = await ctx.prisma.income.findFirst({
          where: {
            userId,
            incomeStreamId: null,
            scheduledDate,
          },
        });
        if (existingManual) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have a manual payment on this date.",
          });
        }
        const row = await ctx.prisma.income.create({
          data: {
            userId,
            incomeStreamId: null,
            scheduledDate,
            amount: input.amount,
            received: input.received,
            description: input.description,
            tagId: input.tagId ?? undefined,
            sourceType: input.sourceType,
            sourceName: input.sourceName?.trim() || null,
            salaryPaySchedule:
              input.sourceType === "SALARY" ? input.salaryPaySchedule : null,
          },
          include: { tag: true, incomeStream: true },
        });
        return { ...row, amount: Number(row.amount) };
      }),

    update: protectedProcedure
      .input(recordUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        const existing = await ctx.prisma.income.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await assertTag(ctx.prisma, userId, input.tagId);
        const row = await ctx.prisma.income.update({
          where: { id: input.id },
          data: {
            ...(input.amount != null ? { amount: input.amount } : {}),
            ...(input.received != null ? { received: input.received } : {}),
            description: input.description,
            tagId: input.tagId ?? undefined,
          },
          include: { tag: true, incomeStream: true },
        });
        return { ...row, amount: Number(row.amount) };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session!.user!.id;
        const existing = await ctx.prisma.income.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await ctx.prisma.income.delete({ where: { id: input.id } });
      }),
  }),
});
