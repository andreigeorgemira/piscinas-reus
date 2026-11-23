'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { NewQuoteButton } from '@/app/admin/quotes/new-quote-dialog'
import { StatusBadge } from '@/app/admin/quotes/status-badge'
import { PreviewDialog, PreviewSkeleton } from '@/components/ui/preview-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import type { ClientPreview } from '@/lib/clients/preview'
import type { Client } from '@/lib/clients/queries'
import { plural } from '@/lib/plural'
import { formatEuros } from '@/lib/price-book/decimal'
import { initialsOf } from '@/lib/settings/brand'
import { EditClientButton } from './client-dialog'
import { loadClientPreview } from './preview-actions'

const ICON = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const PATHS = {
  pencil: <path d="M10.6 2.8 13.2 5.4 5.8 12.8H3.2v-2.6Z" />,
  mail: (
    <>
      <path d="M2.6 4h10.8v8H2.6Z" />
      <path d="m2.8 4.4 5.2 4 5.2-4" />
    </>
  ),
  phone: <path d="M5.4 2.6 6.6 5.4 5.2 6.6a7.4 7.4 0 0 0 4.2 4.2l1.2-1.4 2.8 1.2-.6 2.4c-5.4.4-10.2-4.4-9.8-9.8Z" />,
  pin: (
    <>
      <path d="M8 14s4.4-4 4.4-7.4a4.4 4.4 0 0 0-8.8 0C3.6 10 8 14 8 14Z" />
      <circle cx="8" cy="6.6" r="1.5" />
    </>
  ),
  doc: (
    <>
      <path d="M9.4 2.4H4.6a1 1 0 0 0-1 1v9.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5.4Z" />
      <path d="M9.4 2.4v3h3" />
    </>
  ),
}

function Icon({ name, size = 14 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg {...ICON} width={size} height={size}>
      {PATHS[name]}
    </svg>
  )
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent ${
        size === 'lg' ? 'size-12 text-sm' : 'size-10 text-xs'
      }`}
    >
      {initialsOf(name)}
    </span>
  )
}

const BUTTON =
  'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const SECONDARY = `${BUTTON} border-line bg-surface text-ink-soft hover:bg-surface-hover`

/**
 * Clients as cards: who they are and how to reach them. A click opens their
 * card with the latest quotes; the pencil edits their details on the spot.
 */
export function ClientCards({ clients, defaultVatRate }: { clients: Client[]; defaultVatRate: number | null }) {
  const [selected, setSelected] = useState<Client | null>(null)
  const [preview, setPreview] = useState<ClientPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startLoading] = useTransition()

  function open(client: Client) {
    setSelected(client)
    setPreview(null)
    setError(null)
    startLoading(async () => {
      const result = await loadClientPreview(client.id)
      if ('error' in result) setError(result.error)
      else setPreview(result.preview)
    })
  }

  return (
    <>
      {clients.map((client) => (
        <li key={client.id}>
          <article className="relative flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-faint/70 hover:shadow-pop">
            <div className="flex items-start gap-3">
              <Avatar name={client.fullName} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="truncate text-sm font-semibold text-ink">{client.fullName}</h3>
                <span className="truncate text-xs text-muted">{client.email}</span>
              </div>
              <Tooltip label="Editar">
                <span className="relative z-10">
                  <EditClientButton
                    client={client}
                    label={`Editar ${client.fullName}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  >
                    <Icon name="pencil" />
                  </EditClientButton>
                </span>
              </Tooltip>
            </div>

            <ul className="flex flex-col gap-1 text-xs text-muted">
              <li className="flex items-center gap-2">
                <Icon name="phone" size={12} />
                <span className="truncate">{client.phone ?? 'Sin teléfono'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon name="pin" size={12} />
                <span className="truncate">
                  {[client.city, client.postalCode].filter(Boolean).join(' · ') || 'Sin localidad'}
                </span>
              </li>
            </ul>

            <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3 text-xs">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <Icon name="doc" size={12} />
                {plural(client.quoteCount, 'presupuesto', 'presupuestos')}
              </span>
              <span className={`text-2xs ${client.userId ? 'text-success' : 'text-faint'}`}>
                {client.userId ? 'Con acceso al portal' : 'Sin cuenta'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => open(client)}
              aria-label={`Ficha de ${client.fullName}`}
              className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </article>
        </li>
      ))}

      {selected ? (
        <PreviewDialog
          open
          onOpenChange={(value) => {
            if (!value) setSelected(null)
          }}
          eyebrow={<span>Cliente</span>}
          title={selected.fullName}
          meta={<span>{selected.email}</span>}
          actions={
            <>
              <EditClientButton client={selected} label={`Editar ${selected.fullName}`} className={SECONDARY}>
                <Icon name="pencil" />
                Editar
              </EditClientButton>
              <Link href={`/admin/clients/${selected.id}`} className={SECONDARY}>
                Abrir ficha
              </Link>
              <NewQuoteButton
                client={{ id: selected.id, fullName: selected.fullName }}
                defaultVatRate={defaultVatRate}
              />
            </>
          }
        >
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : preview ? (
            <ClientPreviewBody preview={preview} />
          ) : (
            <PreviewSkeleton />
          )}
        </PreviewDialog>
      ) : null}
    </>
  )
}

function ClientPreviewBody({ preview }: { preview: ClientPreview }) {
  const { client } = preview
  const place = [client.address, [client.postalCode, client.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-center gap-4 rounded-xl bg-surface-sunk p-4">
        <Avatar name={client.fullName} size="lg" />
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className="text-2xs font-medium tracking-[0.05em] text-faint uppercase">Presupuestos</span>
            <span className="num text-lg font-semibold">{preview.quoteCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xs font-medium tracking-[0.05em] text-faint uppercase">Aceptado</span>
            <span className="num text-lg font-semibold">{formatEuros(preview.acceptedTotal)}</span>
          </div>
        </div>
      </section>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <span className="pt-0.5 text-faint">
            <Icon name="mail" />
          </span>
          <div className="min-w-0">
            <dt className="text-2xs text-faint">Correo</dt>
            <dd className="truncate select-all">{client.email}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="pt-0.5 text-faint">
            <Icon name="phone" />
          </span>
          <div className="min-w-0">
            <dt className="text-2xs text-faint">Teléfono</dt>
            <dd className="truncate select-all">{client.phone ?? '—'}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 sm:col-span-2">
          <span className="pt-0.5 text-faint">
            <Icon name="pin" />
          </span>
          <div className="min-w-0">
            <dt className="text-2xs text-faint">Dirección</dt>
            <dd>{place || '—'}</dd>
          </div>
        </div>
      </dl>

      {client.notes ? (
        <p className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm whitespace-pre-line text-ink-soft">
          {client.notes}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">Últimos presupuestos</h3>
        {preview.quotes.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tiene presupuestos.</p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line">
            {preview.quotes.map((quote) => (
              <li key={quote.id} className="border-b border-line-soft last:border-0">
                <Link
                  href={`/admin/quotes/${quote.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="num text-xs font-semibold text-muted">{quote.reference}</span>
                    <span className="truncate text-sm">{quote.title}</span>
                  </span>
                  <StatusBadge status={quote.status} />
                  <span className="num w-24 text-right text-sm font-medium">{formatEuros(quote.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
