/**
 * The controls the quote board is built from, in one place.
 *
 * It is denser than the price book: every row carries three fields and two
 * toggles, so the sizes here are a size down from src/app/admin/price-book/ui.ts
 * (28 px fields inside a 40 px row) and named rather than retyped.
 */
export const CELL_CLASS = 'border-b border-line-soft px-3 py-0 align-middle'

/** A number a row is typed into: the box is visible, the caret is the point. */
export const NUMBER_FIELD_CLASS =
  'inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25'

export const NUMBER_INPUT_CLASS =
  'num min-w-0 bg-transparent text-right text-sm text-ink outline-none placeholder:text-faint'

/** The name of a line the quote owns (a copy, or a free line). */
export const NAME_INPUT_CLASS =
  'num-none w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-ink outline-none hover:border-line focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/25'

/** One half of the Base / Opcional switch. */
export function segmentClass(active: boolean, tone: 'base' | 'optional'): string {
  if (!active) return 'h-[22px] px-2 text-2xs text-muted transition-colors hover:text-ink'
  return tone === 'optional'
    ? 'h-[22px] px-2 text-2xs font-medium text-accent-ink bg-accent'
    : 'h-[22px] px-2 text-2xs font-medium text-canvas bg-ink'
}

export const ROW_ICON_BUTTON_CLASS =
  'flex size-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-sunk hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50'
