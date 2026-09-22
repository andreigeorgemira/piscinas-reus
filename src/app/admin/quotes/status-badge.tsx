import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/quotes/status'

/**
 * A quote's status, in the same colours on every screen it appears on.
 *
 * Colour is never the only carrier: the word is always there. The tones come
 * from the design tokens rather than from raw Tailwind palette values, so the
 * badge follows the theme in dark mode without a second set of classes.
 */
const TONES: Record<QuoteStatus, string> = {
  draft: 'border-line bg-surface-sunk text-muted',
  sent: 'border-accent/40 bg-accent-soft text-accent',
  accepted: 'border-success/40 bg-success-soft text-success',
  rejected: 'border-danger/40 bg-danger-soft text-danger',
}

export function StatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-2xs font-medium whitespace-nowrap ${TONES[status]} ${className ?? ''}`}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  )
}
