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
 * styling itself; there is no className to pass.
 */
export function ConfirmButton({
  question,
  children,
}: {
  /** The one-sentence question. It must name what is about to be lost. */
  question: string
  children: ReactNode
}) {
  // Reads the pending state of the enclosing <form>, so this button must be
  // rendered inside one rather than joined to it with the `form` attribute.
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        // preventDefault on the click is what cancels the submission: the
        // form action never runs, so there is nothing to undo afterwards.
        if (!window.confirm(question)) {
          event.preventDefault()
        }
      }}
      className="rounded border border-red-700 px-2 py-1 text-xs whitespace-nowrap text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700 disabled:opacity-60 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950 dark:focus-visible:outline-red-400"
    >
      {children}
    </button>
  )
}
