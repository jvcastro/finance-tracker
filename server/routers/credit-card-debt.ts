import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const creditCardDebtRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    const rows = await ctx.prisma.creditCardDebt.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
    return rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  }),
  create: protectedProcedure
    .input(
      z.object({
        fromAccount: z.string().min(1).max(120),
        toAccount: z.string().min(1).max(120),
        amount: z.number().positive(),
        date: z.coerce.date(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const row = await ctx.prisma.creditCardDebt.create({
        data: {
          userId,
          fromAccount: input.fromAccount.trim(),
          toAccount: input.toAccount.trim(),
          amount: input.amount,
          date: input.date,
          note: input.note,
        },
      });
      return { ...row, amount: Number(row.amount) };
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fromAccount: z.string().min(1).max(120),
        toAccount: z.string().min(1).max(120),
        amount: z.number().positive(),
        date: z.coerce.date(),
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const existing = await ctx.prisma.creditCardDebt.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const row = await ctx.prisma.creditCardDebt.update({
        where: { id: input.id },
        data: {
          fromAccount: input.fromAccount.trim(),
          toAccount: input.toAccount.trim(),
          amount: input.amount,
          date: input.date,
          note: input.note,
        },
      });
      return { ...row, amount: Number(row.amount) };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const existing = await ctx.prisma.creditCardDebt.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.creditCardDebt.delete({ where: { id: input.id } });
    }),
});
