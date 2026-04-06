import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { ensureDefaultTagsForUser } from "@/lib/default-tags";
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
      const user = await ctx.prisma.user.create({
        data: {
          email,
          name: input.name?.trim() || null,
          passwordHash,
        },
        select: { id: true },
      });
      await ensureDefaultTagsForUser(ctx.prisma, user.id);
      return { ok: true as const };
    }),
});
