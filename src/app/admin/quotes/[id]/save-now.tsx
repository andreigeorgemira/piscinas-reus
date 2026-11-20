'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { HEADER_BUTTON_CLASS } from '@/app/admin/price-book/ui'

/**
 * A Guardar button on a screen that saves itself.
 *
 * It is not there because anything needs saving -- every box writes when the
 * caret leaves it -- but because a form with no save button asks people to trust
 * that, and trust is not a thing a screen gets to assume. So the button does what
 * a person means by it: it takes the caret out of whatever field it is in, which
 * is what triggers that field's save, waits for the write to land and then says
 * everything is saved.
 *
 * The blur is the whole mechanism. Without it, clicking Guardar straight after
 * typing would save nothing, because the field it was typed into had not yet been
 * left -- which would make the button a lie in exactly the case somebody reached
 * for it.
 */
export function SaveNowButton() {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      title="Cada cambio se guarda al salir del campo. Esto lo confirma."
      onClick={() => {
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()

        start(async () => {
          // Long enough for the blur's own save to be sent; the refresh then
          // reads back whatever landed, so the figures on screen are the
          // database's and not the browser's.
          await new Promise((resolve) => setTimeout(resolve, 250))
          router.refresh()
          toast.success('Todo guardado')
        })
      }}
      className={HEADER_BUTTON_CLASS}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-success"
        aria-hidden="true"
      >
        <path d="m3.2 8.4 3.2 3.2 6.4-6.8" />
      </svg>
      {pending ? 'Guardando…' : 'Guardar'}
    </button>
  )
}
