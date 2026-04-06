import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { financialAccountKindSchema } from "@/lib/financial-account-kind";
import { router, protectedProcedure } from "@/server/trpc";

export const financialAccountRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    return ctx.prisma.financialAccount.findMany({
      where: { userId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        kind: financialAccountKindSchema,
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      return ctx.prisma.financialAccount.create({
        data: {
          userId,
          name: input.name.trim(),
          kind: input.kind,
          notes: input.notes?.trim() || null,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120),
        kind: financialAccountKindSchema,
        notes: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const row = await ctx.prisma.financialAccount.findFirst({
        where: { id: input.id, userId },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.financialAccount.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          kind: input.kind,
          notes: input.notes?.trim() || null,
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const row = await ctx.prisma.financialAccount.findFirst({
        where: { id: input.id, userId },
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.financialAccount.delete({ where: { id: input.id } });
    }),
});
