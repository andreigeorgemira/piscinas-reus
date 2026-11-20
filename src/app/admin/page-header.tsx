import type { ReactNode } from 'react'

/**
 * The bar every admin screen starts with: the page's name on the left, its
 * actions on the right.
 *
 * One component rather than a copy per screen, because the thing that makes
 * a dashboard feel like one tool is that this strip is the same height and
 * the same weight everywhere -- h-16, matching the brand block across the
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
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <h1 className="truncate text-lg font-semibold -tracking-[0.02em] text-ink md:text-xl">{title}</h1>
      {meta ? <span className="hidden min-w-0 truncate text-xs text-muted sm:inline">{meta}</span> : null}
      {children ? <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  )
}
