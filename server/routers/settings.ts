import { z } from "zod";

import { router, protectedProcedure } from "@/server/trpc";

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    let row = await ctx.prisma.appSettings.findUnique({
      where: { userId },
    });
    if (!row) {
      row = await ctx.prisma.appSettings.create({
        data: { userId, currency: "PHP", weekStartsOn: 0, completedAppTour: false },
      });
    }
    return row;
  }),

  completeAppTour: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session!.user!.id;
    return ctx.prisma.appSettings.upsert({
      where: { userId },
      create: {
        userId,
        currency: "PHP",
        weekStartsOn: 0,
        completedAppTour: true,
      },
      update: { completedAppTour: true },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        currency: z.string().min(1).max(8),
        weekStartsOn: z.number().int().min(0).max(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id;
      return ctx.prisma.appSettings.upsert({
        where: { userId },
        create: {
          userId,
          currency: input.currency.toUpperCase(),
          weekStartsOn: input.weekStartsOn,
        },
        update: {
          currency: input.currency.toUpperCase(),
          weekStartsOn: input.weekStartsOn,
        },
      });
    }),
});
