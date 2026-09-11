'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useActionState, useEffect, useId } from 'react'
import { toast } from 'sonner'
import { updateProfile } from './profile-actions'
import { idleProfileState } from './profile-state'

const FIELD_CLASS =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-base text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

/**
 * The signed-in user's own details. Two fields, because two is what the
 * profiles table holds that a person would want to change about themselves;
 * the email is the account itself and changing it is a different job.
 */
export function ProfileDialog({
  open,
  onOpenChange,
  email,
  fullName,
  phone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  fullName: string
  phone: string
}) {
  const nameId = useId()
  const phoneId = useId()

  const [state, formAction, pending] = useActionState(updateProfile, idleProfileState)

  useEffect(() => {
    if (state.saved) {
      toast.success('Perfil guardado')
      onOpenChange(false)
    }
  }, [state.saved, onOpenChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-pop">
          <DialogPrimitive.Title className="text-base font-semibold">
            Tu perfil
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="pt-1 text-xs text-muted">
            {email}
          </DialogPrimitive.Description>

          <form action={formAction} className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className="text-xs font-medium">
                Nombre y apellidos
              </label>
              <input
                id={nameId}
                name="full_name"
                defaultValue={fullName}
                maxLength={120}
                placeholder="Andrei Mira"
                className={FIELD_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={phoneId} className="text-xs font-medium">
                Teléfono
              </label>
              <input
                id={phoneId}
                name="phone"
                defaultValue={phone}
                maxLength={40}
                inputMode="tel"
                placeholder="655 11 22 33"
                className={FIELD_CLASS}
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-xs text-danger">
                {state.error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Cancelar
                </button>
              </DialogPrimitive.Close>
              <button
                type="submit"
                disabled={pending}
                className="flex h-8 items-center rounded-md border border-ink bg-ink px-3 text-xs font-medium text-canvas hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              >
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
