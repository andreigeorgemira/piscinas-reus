/**
 * The controls this screen is built from, in one place.
 *
 * They were duplicated across the rowgroup headers, the rows and the forms,
 * which is how a 30px button ends up beside a 28px one. Direction A is a
 * dense tool: the sizes are the design, so they are named rather than
 * retyped. Two heights only -- h-7 inside the table, h-8 in the page header
 * -- and one radius.
 */

const BUTTON_BASE =
  'inline-flex items-center gap-1.5 rounded-md border text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60'

export const BUTTON_CLASS = `${BUTTON_BASE} h-7 border-line bg-surface px-2.5 text-ink-soft hover:bg-surface-hover`

export const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} h-7 border-ink bg-ink px-2.5 text-canvas hover:border-ink-soft hover:bg-ink-soft`

/** The page header sits taller than the table, so its controls do too. */
export const HEADER_BUTTON_CLASS = `${BUTTON_BASE} h-8 border-line bg-surface px-3 text-ink-soft hover:bg-surface-hover`

export const HEADER_PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} h-8 border-ink bg-ink px-3 text-canvas hover:border-ink-soft hover:bg-ink-soft`

/** A square button carrying only an icon. Its name lives on aria-label. */
export const ICON_BUTTON_CLASS =
  'flex size-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60'

export const DANGER_ICON_BUTTON_CLASS =
  'flex size-7 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger disabled:opacity-60'

export const FIELD_CLASS =
  'rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * A field standing in for text that is already on screen: the inline edits.
 *
 * It has no size of its own. The caller passes the same type classes the
 * read-only text uses, so the words keep their font, weight, colour and line
 * height, and the border and padding are paid for with negative margins --
 * the text does not move and the row does not grow. The thin box and the
 * caret are the only things that say it can be typed into now. Focus is a
 * ring, not an outline offset, so it never pushes into the next cell.
 *
 * Put it on the input, or on a wrapper <label> when something that is not
 * typed sits inside the box (the euro sign after a price).
 */
export const INLINE_FIELD_CLASS =
  '-mx-[7px] -my-px rounded-md border border-line bg-surface px-1.5 outline-none placeholder:text-faint transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25'

/** Full cell width for an inline field, winning back its negative margins. */
export const INLINE_FIELD_FILL_CLASS = 'w-[calc(100%+14px)]'
