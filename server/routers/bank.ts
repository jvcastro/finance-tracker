import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const bankRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    return ctx.prisma.bank.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      return ctx.prisma.bank.create({
        data: {
          userId,
          name: input.name.trim(),
          notes: input.notes?.trim() || null,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120),
        notes: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const bank = await ctx.prisma.bank.findFirst({
        where: { id: input.id, userId },
      });
      if (!bank) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.bank.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          notes: input.notes?.trim() || null,
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const bank = await ctx.prisma.bank.findFirst({
        where: { id: input.id, userId },
      });
      if (!bank) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.bank.delete({ where: { id: input.id } });
    }),
});
