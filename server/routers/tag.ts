import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const tagRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    return ctx.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        color: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      try {
        return await ctx.prisma.tag.create({
          data: {
            userId,
            name: input.name.trim(),
            color: input.color,
          },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a tag with this name.",
        });
      }
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(64),
        color: z.string().max(32).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tag = await ctx.prisma.tag.findFirst({
        where: { id: input.id, userId },
      });
      if (!tag) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      try {
        return await ctx.prisma.tag.update({
          where: { id: input.id },
          data: { name: input.name.trim(), color: input.color },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a tag with this name.",
        });
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const tag = await ctx.prisma.tag.findFirst({
        where: { id: input.id, userId },
      });
      if (!tag) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.tag.delete({ where: { id: input.id } });
    }),
});
