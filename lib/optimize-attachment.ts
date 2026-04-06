import "server-only"

import sharp from "sharp"

import { attachmentExtensionForMime } from "@/lib/attachment"

/** Max longest edge for stored receipt images (retina phone photos are still readable). */
const MAX_DIMENSION = 2048

/** WebP quality (balance size vs receipt legibility). */
const WEBP_QUALITY = 82

export type OptimizedAttachment = {
  buffer: Buffer
  mimeType: string
  /** File extension including dot, e.g. `.webp` or `.pdf` */
  extension: string
}

/**
 * PDFs are unchanged. Raster images are auto-oriented, downscaled, and encoded as WebP.
 * Falls back to the original buffer if processing fails.
 */
export async function optimizeAttachmentBuffer(
  input: Buffer,
  sourceMime: string
): Promise<OptimizedAttachment> {
  if (sourceMime === "application/pdf") {
    return {
      buffer: input,
      mimeType: sourceMime,
      extension: ".pdf",
    }
  }

  if (!sourceMime.startsWith("image/")) {
    const ext = attachmentExtensionForMime(sourceMime)
    return {
      buffer: input,
      mimeType: sourceMime,
      extension: ext ?? ".bin",
    }
  }

  try {
    const pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })

    const out = await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()

    return {
      buffer: out,
      mimeType: "image/webp",
      extension: ".webp",
    }
  } catch {
    const ext = attachmentExtensionForMime(sourceMime)
    return {
      buffer: input,
      mimeType: sourceMime,
      extension: ext ?? ".jpg",
    }
  }
}
