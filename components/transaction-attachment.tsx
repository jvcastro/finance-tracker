"use client"

import * as React from "react"
import { IconExternalLink, IconPaperclip, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  ATTACHMENT_MAX_BYTES,
  isAllowedAttachmentMime,
} from "@/lib/attachment"
import { trpc } from "@/lib/trpc/react"

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf"

export type AttachmentEntity = "expense" | "income"

type FormBlockProps = {
  entity: AttachmentEntity
  recordId: string | null
  attachmentKey: string | null
  attachmentMime: string | null
  pendingFile: File | null
  onPendingFileChange: (file: File | null) => void
  /** Called after stored attachment is removed (keep parent row state in sync). */
  onAttachmentRemoved?: () => void
  disabled?: boolean
}

export function TransactionAttachmentFormBlock({
  entity,
  recordId,
  attachmentKey,
  attachmentMime,
  pendingFile,
  onPendingFileChange,
  onAttachmentRemoved,
  disabled,
}: FormBlockProps) {
  const utils = trpc.useUtils()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const clearMut = trpc.storage.clearAttachment.useMutation({
    onSuccess: () => {
      void utils.expense.list.invalidate()
      void utils.income.record.list.invalidate()
      toast.success("Attachment removed.")
      onAttachmentRemoved?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const hasStored = Boolean(recordId && attachmentKey)
  const showRemoveStored =
    hasStored && !pendingFile && !clearMut.isPending

  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">
        <IconPaperclip className="size-4 text-muted-foreground" aria-hidden />
        Receipt or invoice (optional)
      </Label>
      <p className="text-xs text-muted-foreground">
        PDF or image (JPEG, PNG, WebP, GIF). Max{" "}
        {Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ""
          if (!f) {
            onPendingFileChange(null)
            return
          }
          if (!isAllowedAttachmentMime(f.type)) {
            toast.error("Choose a PDF or image file.")
            return
          }
          if (f.size > ATTACHMENT_MAX_BYTES) {
            toast.error("File is too large.")
            return
          }
          onPendingFileChange(f)
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {pendingFile ? "Replace file" : "Choose file"}
        </Button>
        {pendingFile ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {pendingFile.name}
          </span>
        ) : hasStored ? (
          <span className="text-sm text-muted-foreground">
            {attachmentMime === "application/pdf"
              ? "PDF on file"
              : "Image on file"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No file selected</span>
        )}
        {pendingFile ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={disabled}
            onClick={() => onPendingFileChange(null)}
          >
            Clear selection
          </Button>
        ) : null}
        {showRemoveStored && recordId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={disabled || clearMut.isPending}
            onClick={() =>
              clearMut.mutate({ entity, recordId })
            }
          >
            <IconTrash className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Uploads via same-origin API (avoids R2 CORS on browser PUT). */
export async function uploadTransactionAttachment(
  entity: AttachmentEntity,
  recordId: string,
  file: File
) {
  const formData = new FormData()
  formData.set("entity", entity)
  formData.set("recordId", recordId)
  formData.set("file", file)
  const res = await fetch("/api/r2/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Upload failed (${res.status})`)
  }
}

type DetailProps = {
  entity: AttachmentEntity
  recordId: string
  hasAttachment: boolean
}

export function TransactionAttachmentDetailPreview({
  entity,
  recordId,
  hasAttachment,
}: DetailProps) {
  const [viewerOpen, setViewerOpen] = React.useState(false)
  const { data, isLoading, error } = trpc.storage.getAttachmentUrl.useQuery(
    { entity, recordId },
    { enabled: hasAttachment && viewerOpen }
  )

  if (!hasAttachment) return null

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5">
        <span className="text-muted-foreground">Receipt / invoice</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setViewerOpen(true)}
        >
          View
        </Button>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <DialogHeader className="shrink-0 border-b border-border/80 px-4 py-3 text-left">
            <DialogTitle className="text-base">Receipt / invoice</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : error || !data ? (
              <p className="text-sm text-destructive">
                Could not load attachment.
              </p>
            ) : data.mimeType === "application/pdf" ? (
              <iframe
                src={data.url}
                className="h-[min(75vh,640px)] w-full rounded-md border border-border/80 bg-muted/20"
                title="PDF receipt"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.url}
                alt="Receipt or invoice"
                className="mx-auto max-h-[min(75vh,640px)] w-full object-contain"
              />
            )}
          </div>
          {data?.url ? (
            <DialogFooter className="shrink-0 border-t border-border/80 px-4 py-3 sm:justify-start">
              <Button variant="outline" size="sm" asChild>
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                  <IconExternalLink className="size-4" />
                  Open in new tab
                </a>
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
