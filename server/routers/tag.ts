import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isProtectedTagName } from "@/lib/default-tags";
import { router, protectedProcedure } from "@/server/trpc";

const PROTECTED_TAG_MESSAGE =
  "The “Credit card” tag is built in and cannot be changed or removed.";
const RESERVED_NAME_MESSAGE =
  "That tag name is reserved for the built-in Credit card tag.";

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
      if (isProtectedTagName(input.name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: RESERVED_NAME_MESSAGE,
        });
      }
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
      if (isProtectedTagName(tag.name)) {
        throw new TRPCError({ code: "FORBIDDEN", message: PROTECTED_TAG_MESSAGE });
      }
      if (isProtectedTagName(input.name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: RESERVED_NAME_MESSAGE,
        });
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
      if (isProtectedTagName(tag.name)) {
        throw new TRPCError({ code: "FORBIDDEN", message: PROTECTED_TAG_MESSAGE });
      }
      await ctx.prisma.tag.delete({ where: { id: input.id } });
    }),
});
