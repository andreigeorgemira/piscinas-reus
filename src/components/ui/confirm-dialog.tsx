'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useState, type ReactNode } from 'react'

/**
 * The question asked before something irreversible happens.
 *
 * This replaced window.confirm, which blocked the whole tab, could not say
 * more than one line, and looked like a browser error rather than part of
 * the app. The important part is not the styling: it is that this one can
 * list what will actually happen, which a one-line prompt cannot.
 *
 * Only for writes that cannot be undone from the screen. A confirmation on
 * something reversible teaches people to click through confirmations.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  risks,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** What will happen, one consequence per line. */
  risks?: ReactNode[]
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'normal'
  onConfirm: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          role="alertdialog"
          className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-pop"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5.6v3.2M8 11.4h.01" />
                <path d="M6.9 2.4 1.7 11.4a1.2 1.2 0 0 0 1.1 1.8h10.4a1.2 1.2 0 0 0 1.1-1.8L9.1 2.4a1.2 1.2 0 0 0-2.2 0Z" />
              </svg>
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <DialogPrimitive.Title className="text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-sm text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
              {risks && risks.length > 0 ? (
                <ul className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-sunk p-3 text-sm text-ink-soft">
                  {risks.map((risk, index) => (
                    <li key={index} className="flex gap-2">
                      <span aria-hidden="true" className="text-faint">
                        •
                      </span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {cancelLabel}
              </button>
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={`flex h-8 items-center rounded-md border px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
                tone === 'danger'
                  ? 'border-[#b91c1c] bg-[#b91c1c] hover:bg-[#991b1b] focus-visible:outline-danger'
                  : 'border-ink bg-ink text-canvas hover:bg-ink-soft focus-visible:outline-accent'
              }`}
            >
              {pending ? 'Un momento…' : confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
