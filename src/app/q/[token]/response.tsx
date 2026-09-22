'use client'

import { useActionState, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { idleState, type ActionState } from '@/app/admin/action-state'
import { formatEuros } from '@/lib/price-book/decimal'
import { acceptQuote, rejectQuote } from './actions'

/**
 * Signing, or saying no.
 *
 * The signature is a name typed in a box and, if the person feels like it, a
 * drawing. Neither is a qualified electronic signature and this page does not
 * pretend otherwise: what it records is who pressed the button, when, from what
 * browser, and against which version of the document -- the token dies the
 * moment the quote is reopened, so a signature always belongs to the figures
 * that were on screen.
 *
 * The drawing is a canvas rather than an upload because the person doing it is
 * on a phone in a garden. It is optional, it is cleared with one button, and it
 * travels as a PNG data URL in a hidden field.
 */
export function QuoteResponse({ token, total }: { token: string; total: number }) {
  const nameId = useId()
  const reasonId = useId()
  const [rejecting, setRejecting] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const signature = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const [hasDrawing, setHasDrawing] = useState(false)

  const [acceptState, acceptAction, accepting] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const image = canvas.current && hasDrawing ? canvas.current.toDataURL('image/png') : ''
      if (signature.current) signature.current.value = image
      formData.set('signature', image)

      const next = await acceptQuote(previous, formData)
      if (next.error === null) toast.success('¡Gracias! Presupuesto aceptado.')
      return next
    },
    idleState,
  )

  const [rejectState, rejectAction, sendingRejection] = useActionState<ActionState, FormData>(
    rejectQuote,
    idleState,
  )

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const element = canvas.current
    if (!element) return null
    const box = element.getBoundingClientRect()
    return {
      x: ((event.clientX - box.left) / box.width) * element.width,
      y: ((event.clientY - box.top) / box.height) * element.height,
    }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvas.current?.getContext('2d')
    const from = point(event)
    if (!context || !from) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#16181d'
    context.beginPath()
    context.moveTo(from.x, from.y)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const context = canvas.current?.getContext('2d')
    const to = point(event)
    if (!context || !to) return
    context.lineTo(to.x, to.y)
    context.stroke()
    setHasDrawing(true)
  }

  function stop() {
    drawing.current = false
  }

  function clear() {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    context.clearRect(0, 0, element.width, element.height)
    setHasDrawing(false)
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold">Firmar el presupuesto</h2>
      <p className="pt-1 text-xs text-muted">
        {`Al firmar aceptas los ${formatEuros(total)} de arriba, con los extras que hayas marcado.`}
      </p>

      <form action={acceptAction} className="flex flex-col gap-4 pt-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="signature" ref={signature} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-xs font-medium">
            Nombre y apellidos
            <span className="text-danger" title="Obligatorio">
              {' *'}
            </span>
          </label>
          <input
            id={nameId}
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Marta Soler"
            className="h-10 rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Firma (opcional)</span>
          <div className="relative rounded-md border border-dashed border-line bg-canvas">
            <canvas
              ref={canvas}
              width={640}
              height={180}
              onPointerDown={start}
              onPointerMove={draw}
              onPointerUp={stop}
              onPointerLeave={stop}
              aria-label="Dibuja aquí tu firma"
              className="h-[130px] w-full touch-none"
            />
            {!hasDrawing ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-faint">
                Dibuja aquí con el dedo o el ratón
              </span>
            ) : null}
          </div>
          {hasDrawing ? (
            <button
              type="button"
              onClick={clear}
              className="w-fit text-xs text-accent underline underline-offset-2"
            >
              Borrar la firma
            </button>
          ) : null}
        </div>

        {acceptState.error ? (
          <p role="alert" className="text-xs text-danger">
            {acceptState.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={accepting}
          className="flex h-11 items-center justify-center rounded-lg border border-ink bg-ink px-5 text-sm font-semibold text-canvas transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {accepting ? 'Firmando…' : 'Acepto el presupuesto'}
        </button>
      </form>

      <div className="pt-4">
        {rejecting ? (
          <form action={rejectAction} className="flex flex-col gap-2 border-t border-line pt-4">
            <input type="hidden" name="token" value={token} />
            <label htmlFor={reasonId} className="text-xs font-medium">
              ¿Nos cuentas por qué? (opcional)
            </label>
            <textarea
              id={reasonId}
              name="reason"
              rows={2}
              maxLength={2000}
              placeholder="Precio, plazos, nos hemos decidido por otra empresa…"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            {rejectState.error ? (
              <p role="alert" className="text-xs text-danger">
                {rejectState.error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="flex h-9 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sendingRejection}
                className="flex h-9 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                {sendingRejection ? 'Enviando…' : 'Enviar respuesta'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="text-xs text-muted underline underline-offset-2 hover:text-ink"
          >
            No me interesa
          </button>
        )}
      </div>
    </section>
  )
}
