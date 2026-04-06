import "server-only"

import type { PrismaClient } from "@/generated/prisma/client"
import { deleteR2Object } from "@/lib/r2"

export function attachmentKeyPrefix(
  userId: string,
  entity: "expense" | "income",
  recordId: string
) {
  const seg = entity === "expense" ? "expenses" : "incomes"
  return `users/${userId}/${seg}/${recordId}/`
}

/** Save attachment metadata and remove previous object when replacing. */
export async function persistAttachment(
  prisma: PrismaClient,
  userId: string,
  input: {
    entity: "expense" | "income"
    recordId: string
    key: string
    mimeType: string
  }
): Promise<void> {
  const prefix = attachmentKeyPrefix(userId, input.entity, input.recordId)
  if (!input.key.startsWith(prefix) || input.key.length <= prefix.length) {
    throw new Error("Invalid upload key.")
  }

  if (input.entity === "expense") {
    const existing = await prisma.expense.findFirst({
      where: { id: input.recordId, userId },
    })
    if (!existing) throw new Error("NOT_FOUND")
    if (existing.attachmentKey && existing.attachmentKey !== input.key) {
      await deleteR2Object(existing.attachmentKey)
    }
    await prisma.expense.update({
      where: { id: input.recordId },
      data: {
        attachmentKey: input.key,
        attachmentMime: input.mimeType,
      },
    })
  } else {
    const existing = await prisma.income.findFirst({
      where: { id: input.recordId, userId },
    })
    if (!existing) throw new Error("NOT_FOUND")
    if (existing.attachmentKey && existing.attachmentKey !== input.key) {
      await deleteR2Object(existing.attachmentKey)
    }
    await prisma.income.update({
      where: { id: input.recordId },
      data: {
        attachmentKey: input.key,
        attachmentMime: input.mimeType,
      },
    })
  }
}
