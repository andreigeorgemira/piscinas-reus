/**
 * The controls this screen is built from, in one place.
 *
 * They were duplicated across the section header, the rows and the forms,
 * which is how a 30px button ends up beside a 28px one. Direction A is a
 * dense tool: the sizes are the design, so they are named rather than
 * retyped.
 */

export const BUTTON_CLASS =
  'flex h-[26px] items-center gap-1.5 rounded-[5px] border border-line bg-surface px-2.5 text-xs font-medium whitespace-nowrap text-ink-soft hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60'

export const PRIMARY_BUTTON_CLASS =
  'flex h-[26px] items-center gap-1.5 rounded-[5px] border border-ink bg-ink px-2.5 text-xs font-medium whitespace-nowrap text-canvas hover:bg-ink-soft hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60'

/** A square button carrying only an icon. Its name lives on aria-label. */
export const ICON_BUTTON_CLASS =
  'flex size-6 items-center justify-center rounded border border-line bg-surface text-ink-soft hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60'

export const DANGER_ICON_BUTTON_CLASS =
  'flex size-6 items-center justify-center rounded border border-line bg-surface text-danger hover:border-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-danger disabled:opacity-60'

export const FIELD_CLASS =
  'rounded-[4px] border border-line bg-surface px-2 py-1 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
