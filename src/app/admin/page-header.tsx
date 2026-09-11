import type { ReactNode } from 'react'

/**
 * The bar every admin screen starts with: the page's name on the left, its
 * actions on the right.
 *
 * One component rather than a copy per screen, because the thing that makes
 * a dashboard feel like one tool is that this strip is the same height and
 * the same weight everywhere -- h-14, matching the brand block across the
 * sidebar seam.
 */
export function PageHeader({
  title,
  meta,
  children,
}: {
  title: string
  /** A short count or status beside the title. Never a sentence. */
  meta?: ReactNode
  /** Actions, right-aligned. */
  children?: ReactNode
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-5">
      <h1 className="text-lg font-semibold -tracking-[0.01em]">{title}</h1>
      {meta ? <span className="text-xs text-faint">{meta}</span> : null}
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </header>
  )
}
