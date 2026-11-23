'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

/**
 * A look at one record before opening it: the dialog a card opens. Title and
 * meta on top, the body scrolling, the actions fixed at the foot where the
 * thumb and the eye end up.
 */
export function PreviewDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  meta,
  actions,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eyebrow?: ReactNode
  title: string
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-[overlay-in_160ms_ease-out]" />
        <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[min(44rem,calc(100dvh-3rem))] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <header className="flex items-start gap-3 border-b border-line-soft px-5 pt-5 pb-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {eyebrow ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{eyebrow}</div> : null}
              <DialogPrimitive.Title className="text-lg leading-snug font-semibold -tracking-[0.01em] text-ink">
                {title}
              </DialogPrimitive.Title>
              {meta ? (
                <DialogPrimitive.Description asChild>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">{meta}</div>
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">Vista previa</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {actions ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-surface-sunk/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              {actions}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** A grey block the size of what is loading. */
export function PreviewSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-label="Cargando" role="status">
      <div className="h-16 rounded-xl bg-surface-sunk" />
      <div className="h-4 w-1/3 rounded bg-surface-sunk" />
      <div className="h-10 rounded-lg bg-surface-sunk" />
      <div className="h-10 rounded-lg bg-surface-sunk" />
      <div className="h-10 rounded-lg bg-surface-sunk" />
    </div>
  )
}
