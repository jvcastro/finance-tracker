import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  ATTACHMENT_MAX_BYTES,
  isAllowedAttachmentMime,
} from "@/lib/attachment"
import { attachmentKeyPrefix, persistAttachment } from "@/lib/attachment-persist"
import { prisma } from "@/lib/db"
import { optimizeAttachmentBuffer } from "@/lib/optimize-attachment"
import { deleteR2Object, putObjectBuffer } from "@/lib/r2"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const entityRaw = formData.get("entity")
  const recordIdRaw = formData.get("recordId")
  const file = formData.get("file")

  if (typeof entityRaw !== "string" || typeof recordIdRaw !== "string") {
    return NextResponse.json({ error: "Missing entity or recordId" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const entity = entityRaw === "expense" || entityRaw === "income" ? entityRaw : null
  if (!entity) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 })
  }

  if (!isAllowedAttachmentMime(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and common image types are allowed." },
      { status: 400 }
    )
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large." }, { status: 400 })
  }

  if (entity === "expense") {
    const row = await prisma.expense.findFirst({
      where: { id: recordIdRaw, userId },
    })
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  } else {
    const row = await prisma.income.findFirst({
      where: { id: recordIdRaw, userId },
    })
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const optimized = await optimizeAttachmentBuffer(raw, file.type)

  if (optimized.buffer.length > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: "File is still too large after processing." },
      { status: 400 }
    )
  }

  const key = `${attachmentKeyPrefix(userId, entity, recordIdRaw)}${randomUUID()}${optimized.extension}`

  try {
    await putObjectBuffer({
      key,
      contentType: optimized.mimeType,
      body: optimized.buffer,
    })
    await persistAttachment(prisma, userId, {
      entity,
      recordId: recordIdRaw,
      key,
      mimeType: optimized.mimeType,
    })
  } catch (e) {
    await deleteR2Object(key)
    console.error("[r2 upload]", e)
    return NextResponse.json(
      { error: "Upload failed. Try again." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true as const })
}
