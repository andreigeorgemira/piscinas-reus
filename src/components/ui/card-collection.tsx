import type { ReactNode } from 'react'

/**
 * The card view's frame, built like DataTable's: the same toolbar on top and
 * the same footer below, with a grid of cards scrolling in between. Switching
 * between the two views moves nothing but the content.
 */
export function CardCollection({
  toolbar,
  footer,
  empty,
  children,
}: {
  toolbar?: ReactNode
  footer?: ReactNode
  empty?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {toolbar}
      <div className="relative min-h-0 flex-1 overflow-y-auto bg-surface-sunk/60 p-3 md:p-4">
        {empty ? (
          <div className="flex h-full items-center justify-center">{empty}</div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</ul>
        )}
      </div>
      {footer}
    </div>
  )
}
