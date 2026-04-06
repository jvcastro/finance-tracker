/** Allowed receipt/invoice uploads (images + PDF). */
export const ATTACHMENT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIME)[number]

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

const MIME_TO_EXT: Record<AttachmentMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
}

export function attachmentExtensionForMime(mime: string): string | null {
  if (!ATTACHMENT_ALLOWED_MIME.includes(mime as AttachmentMime)) return null
  return MIME_TO_EXT[mime as AttachmentMime]
}

export function isAllowedAttachmentMime(mime: string): mime is AttachmentMime {
  return ATTACHMENT_ALLOWED_MIME.includes(mime as AttachmentMime)
}
