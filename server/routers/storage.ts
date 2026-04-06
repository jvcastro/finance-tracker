import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { attachmentKeyPrefix, persistAttachment } from "@/lib/attachment-persist"
import { isAllowedAttachmentMime } from "@/lib/attachment"
import { deleteR2Object, headObjectExists, presignGet } from "@/lib/r2"
import { router, protectedProcedure } from "@/server/trpc"

const entitySchema = z.enum(["expense", "income"])

export const storageRouter = router({
  commitAttachment: protectedProcedure
    .input(
      z.object({
        entity: entitySchema,
        recordId: z.string(),
        key: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      if (!isAllowedAttachmentMime(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only PDF and common image types are allowed.",
        })
      }
      const prefix = attachmentKeyPrefix(userId, input.entity, input.recordId)
      if (!input.key.startsWith(prefix) || input.key.length <= prefix.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid upload key." })
      }

      const ok = await headObjectExists(input.key)
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload did not complete. Try again.",
        })
      }

      try {
        await persistAttachment(ctx.prisma, userId, input)
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND" })
        }
        throw e
      }
      return { ok: true as const }
    }),

  getAttachmentUrl: protectedProcedure
    .input(
      z.object({
        entity: entitySchema,
        recordId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      let key: string | null = null
      let mime: string | null = null
      if (input.entity === "expense") {
        const row = await ctx.prisma.expense.findFirst({
          where: { id: input.recordId, userId },
          select: { attachmentKey: true, attachmentMime: true },
        })
        key = row?.attachmentKey ?? null
        mime = row?.attachmentMime ?? null
      } else {
        const row = await ctx.prisma.income.findFirst({
          where: { id: input.recordId, userId },
          select: { attachmentKey: true, attachmentMime: true },
        })
        key = row?.attachmentKey ?? null
        mime = row?.attachmentMime ?? null
      }
      if (!key || !mime) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No attachment." })
      }
      const url = await presignGet(key)
      return { url, mimeType: mime }
    }),

  clearAttachment: protectedProcedure
    .input(
      z.object({
        entity: entitySchema,
        recordId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id
      if (input.entity === "expense") {
        const existing = await ctx.prisma.expense.findFirst({
          where: { id: input.recordId, userId },
        })
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
        if (existing.attachmentKey) {
          await deleteR2Object(existing.attachmentKey)
        }
        await ctx.prisma.expense.update({
          where: { id: input.recordId },
          data: { attachmentKey: null, attachmentMime: null },
        })
      } else {
        const existing = await ctx.prisma.income.findFirst({
          where: { id: input.recordId, userId },
        })
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
        if (existing.attachmentKey) {
          await deleteR2Object(existing.attachmentKey)
        }
        await ctx.prisma.income.update({
          where: { id: input.recordId },
          data: { attachmentKey: null, attachmentMime: null },
        })
      }
      return { ok: true as const }
    }),
})
