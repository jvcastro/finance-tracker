import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const expenseRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    const rows = await ctx.prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { tag: true },
    });
    return rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  }),
  create: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        date: z.coerce.date(),
        description: z.string().max(500).optional(),
        tagId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      if (input.tagId) {
        const tag = await ctx.prisma.tag.findFirst({
          where: { id: input.tagId, userId },
        });
        if (!tag) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tag." });
        }
      }
      const row = await ctx.prisma.expense.create({
        data: {
          userId,
          amount: input.amount,
          date: input.date,
          description: input.description,
          tagId: input.tagId ?? undefined,
        },
        include: { tag: true },
      });
      return { ...row, amount: Number(row.amount) };
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        amount: z.number().positive(),
        date: z.coerce.date(),
        description: z.string().max(500).optional().nullable(),
        tagId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (input.tagId) {
        const tag = await ctx.prisma.tag.findFirst({
          where: { id: input.tagId, userId },
        });
        if (!tag) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tag." });
        }
      }
      const row = await ctx.prisma.expense.update({
        where: { id: input.id },
        data: {
          amount: input.amount,
          date: input.date,
          description: input.description,
          tagId: input.tagId ?? undefined,
        },
        include: { tag: true },
      });
      return { ...row, amount: Number(row.amount) };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const existing = await ctx.prisma.expense.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.expense.delete({ where: { id: input.id } });
    }),
});
