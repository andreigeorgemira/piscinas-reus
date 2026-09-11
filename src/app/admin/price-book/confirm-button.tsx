'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * A submit button that asks a yes/no question before it lets the form go.
 *
 * The browser's own confirm() rather than a hand-built modal: this screen has
 * three users and one sentence to ask them, and a custom dialog would need
 * focus trapping, an escape route and an accessible name to be no worse than
 * what the browser already ships. Blocking the main thread is the point here
 * -- nothing else on the page should move while the question is open.
 *
 * Every use of this button is destructive, so it carries the destructive
 * styling itself; `className` only chooses between the labelled and the
 * icon-sized shape.
 */
export function ConfirmButton({
  question,
  label,
  className,
  children,
}: {
  /** The one-sentence question. It must name what is about to be lost. */
  question: string
  /** The accessible name, when the visible content is an icon. */
  label?: string
  className?: string
  children: ReactNode
}) {
  // Reads the pending state of the enclosing <form>, so this button must be
  // rendered inside one rather than joined to it with the `form` attribute.
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      onClick={(event) => {
        // preventDefault on the click is what cancels the submission: the
        // form action never runs, so there is nothing to undo afterwards.
        if (!window.confirm(question)) {
          event.preventDefault()
        }
      }}
      className={
        className ??
        'inline-flex h-7 items-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium whitespace-nowrap text-danger transition-colors hover:border-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60'
      }
    >
      {children}
    </button>
  )
}
