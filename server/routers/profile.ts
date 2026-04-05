import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const profileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    return ctx.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });
  }),
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().max(120).optional().nullable(),
        email: z.string().max(254).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      const email =
        input.email === undefined || input.email === null || input.email.trim() === ""
          ? null
          : input.email.trim().toLowerCase();
      if (email) {
        const parsed = z.string().email().safeParse(email);
        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid email",
          });
        }
        const taken = await ctx.prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
        });
        if (taken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That email is already in use.",
          });
        }
      }
      return ctx.prisma.user.update({
        where: { id: userId },
        data: {
          name: input.name,
          email: email ?? undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });
    }),
});
