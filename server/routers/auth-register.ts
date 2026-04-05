import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { router, publicProcedure } from "@/server/trpc";

export const authRegisterRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();
      const existing = await ctx.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      await ctx.prisma.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          passwordHash,
        },
      });
      return { ok: true as const };
    }),
});
