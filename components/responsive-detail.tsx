"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMinSm } from "@/hooks/use-is-min-sm"

type ResponsiveDetailProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
  /** Sheet-only: passed to SheetContent */
  sheetClassName?: string
}

/** Bottom sheet on mobile; centered dialog on `sm+`. */
export function ResponsiveDetail({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  sheetClassName,
}: ResponsiveDetailProps) {
  const isDesktop = useIsMinSm()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogHeader className="shrink-0 border-b border-border/80 px-6 py-4 text-left">
            <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 text-sm text-foreground">
            {children}
          </div>
          <div className="shrink-0 border-t border-border/80 px-6 py-4">
            {footer}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={
          sheetClassName ??
          "max-h-[90vh] overflow-y-auto rounded-t-2xl px-0 sm:max-w-lg"
        }
      >
        <SheetHeader className="px-6 pb-2 text-left">
          <SheetTitle className="text-base leading-snug">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="sr-only">{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="space-y-0 px-6 text-sm text-foreground">{children}</div>
        <div className="mt-auto border-t border-border/80 px-6 py-4">{footer}</div>
      </SheetContent>
    </Sheet>
  )
}
