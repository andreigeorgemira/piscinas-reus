import type { ReactNode } from 'react'

export type TableColumn = {
  /** Stable key, also used for the React key. */
  key: string
  label: string
  /** A Tailwind width class. Omit for the column that takes the slack. */
  width?: string
  align?: 'left' | 'right'
  /** A column whose header is a label for screen readers only (actions). */
  srOnly?: boolean
}

/**
 * The one table shell every list screen uses, so they cannot drift apart.
 *
 * `table-fixed` plus per-column widths is what makes long text truncate
 * instead of shoving the numeric columns around, and what keeps the columns
 * of a grouped table aligned from the first rowgroup to the last. The header
 * sticks to the top of the scroll container, so a catalogue read halfway
 * down still says which column is the cost and which the price.
 */
export function DataTable({
  columns,
  children,
  toolbar,
  footer,
  empty,
}: {
  columns: TableColumn[]
  /** One or more <tbody> elements. */
  children?: ReactNode
  /** A strip above the column headers: search, filters, screen actions. */
  toolbar?: ReactNode
  /** A strip under the table: a pager, a total, an add control. */
  footer?: ReactNode
  /** Rendered instead of the rows when there is nothing to show. */
  empty?: ReactNode
}) {
  return (
    /*
     * The card fills the height it is given and scrolls inside itself. The
     * page never scrolls: the sidebar, the page header and the action bar
     * stay put, the rows move under them, and the pager stays reachable at
     * the bottom without scrolling to the end of the catalogue to find it.
     *
     * min-h-0 on both the card and the scroll area is what makes that work:
     * a flex child's default min-height is its content, so without it the
     * card grows to fit every row and the scrollbar lands on the page.
     */
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {toolbar}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} className={column.width} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-2xs font-medium tracking-[0.05em] text-muted uppercase ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>

        {/*
          The empty state sits INSIDE the table's own scroll area, under the
          column headers, and takes the space the rows would have. The card
          is the same size whether the catalogue has eighty concepts or none
          -- a screen that shrinks when a search finds nothing is a screen
          that moves every control the moment you need them.
        */}
        {empty ? <div className="flex flex-1 items-center justify-center">{empty}</div> : null}
      </div>
      {footer}
    </div>
  )
}

/** The empty state a DataTable shows in place of its rows. */
export function TableEmpty({
  icon,
  message,
  children,
}: {
  icon?: ReactNode
  message: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
      {icon ? <span className="text-faint">{icon}</span> : null}
      <p className="text-sm text-muted">{message}</p>
      {children}
    </div>
  )
}
