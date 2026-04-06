import type { PrismaClient } from "@/generated/prisma/client"

/**
 * Seeded for every user (register, sign-in, `prisma db seed`). Idempotent
 * (`@@unique([userId, name])`). Colors help charts and tag lists.
 */
export const CREDIT_CARD_TAG_NAME = "Credit card";

/** Reserved for dashboards and defaults; cannot be renamed, recolored, or deleted. */
export function isProtectedTagName(name: string): boolean {
  return name.trim() === CREDIT_CARD_TAG_NAME;
}

export const DEFAULT_TAGS_FOR_USER = [
  { name: CREDIT_CARD_TAG_NAME, color: "#6366f1" },
  { name: "Mortgage", color: "#22c55e" },
  { name: "Loan", color: "#f97316" },
  { name: "Groceries", color: "#22c55e" },
  { name: "Dining out", color: "#f97316" },
  { name: "Housing", color: "#8b5cf6" },
  { name: "Utilities", color: "#06b6d4" },
  { name: "Transportation", color: "#eab308" },
  { name: "Subscriptions", color: "#a855f7" },
  { name: "Entertainment", color: "#ec4899" },
  { name: "Health", color: "#14b8a6" },
  { name: "Shopping", color: "#0ea5e9" },
  { name: "Personal care", color: "#d946ef" },
  { name: "Savings & investments", color: "#64748b" },
] as const

export async function ensureDefaultTagsForUser(
  prisma: PrismaClient,
  userId: string
) {
  await prisma.tag.createMany({
    data: DEFAULT_TAGS_FOR_USER.map((t) => ({
      userId,
      name: t.name,
      color: t.color,
    })),
    skipDuplicates: true,
  })
}
