import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function createTRPCContext() {
  const session = await auth();
  return { prisma, session };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;

export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

export const protectedProcedure = t.procedure.use(isAuthed);
