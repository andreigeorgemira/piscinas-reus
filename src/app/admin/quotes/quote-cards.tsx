'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { PreviewDialog, PreviewSkeleton } from '@/components/ui/preview-dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { roundMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { formatEuros } from '@/lib/price-book/decimal'
import { GROUP_DISPLAY_LABELS } from '@/lib/quotes/presentation'
import type { QuotePreview } from '@/lib/quotes/preview'
import type { QuoteCardSummary, QuoteListRow } from '@/lib/quotes/queries'
import { formatVatRate } from '@/lib/vat'
import { loadQuotePreview } from './preview-actions'
import { StatusBadge } from './status-badge'

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

function PencilIcon() {
  return (
    <svg {...ICON}>
      <path d="M10.6 2.8 13.2 5.4 5.8 12.8H3.2v-2.6Z" />
    </svg>
  )
}

function date(iso: string | null): string {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

/** What the client would pay: with VAT when the quote carries it. */
function payable(totals: { grandTotal: number; vatRate: number | null; totalWithVat: number }): number {
  return totals.vatRate === null ? totals.grandTotal : totals.totalWithVat
}

const BUTTON =
  'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const SECONDARY = `${BUTTON} border-line bg-surface text-ink-soft hover:bg-surface-hover`
const PRIMARY = `${BUTTON} border-primary bg-primary text-primary-ink hover:border-primary-hover hover:bg-primary-hover`

/**
 * The quote list as cards: what each quote is, for whom and for how much, at a
 * glance. A click opens a preview with the document's groups and totals; the
 * pencil (and the preview's main button) open the editor.
 */
/** How many groups the little document on a card lists before "+ N más". */
const SHOWN_GROUPS = 4

/**
 * The quote's contents as a tiny sheet of paper: its groups with their
 * subtotals, the way the document prints them, so a card says what was quoted
 * and not only for how much.
 */
function MiniDocument({ summary }: { summary: QuoteCardSummary | undefined }) {
  const groups = summary?.groups ?? []
  const hidden = groups.length - SHOWN_GROUPS

  return (
    <div className="rounded-lg bg-surface-sunk p-2">
      <div className="flex min-h-[7.5rem] flex-col rounded-md border border-line bg-surface px-3 pt-2.5 pb-2 shadow-card">
        <div aria-hidden="true" className="mb-2 h-0.5 w-8 rounded-full bg-ink/80" />
        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col gap-1.5" aria-label="Sin líneas todavía">
            <div className="h-1.5 w-3/4 rounded-full bg-surface-sunk" />
            <div className="h-1.5 w-1/2 rounded-full bg-surface-sunk" />
            <div className="h-1.5 w-2/3 rounded-full bg-surface-sunk" />
            <span className="mt-auto text-[10px] text-faint">Sin líneas todavía</span>
          </div>
        ) : (
          <ul className="flex flex-1 flex-col">
            {groups.slice(0, SHOWN_GROUPS).map((group) => (
              <li key={group.name} className="flex items-baseline gap-1.5 text-[11px] leading-5">
                <span className="max-w-[60%] truncate text-ink-soft">{group.name}</span>
                <span aria-hidden="true" className="min-w-3 flex-1 -translate-y-[3px] border-b border-dotted border-line" />
                <span className="num shrink-0 text-ink">{formatEuros(group.subtotal)}</span>
              </li>
            ))}
            {hidden > 0 || (summary?.extrasCount ?? 0) > 0 ? (
              <li className="flex gap-2 pt-0.5 text-[10px] text-faint">
                {hidden > 0 ? <span>{`+ ${plural(hidden, 'grupo más', 'grupos más')}`}</span> : null}
                {summary && summary.extrasCount > 0 ? (
                  <span className="text-accent">{`+ ${plural(summary.extrasCount, 'extra', 'extras')}`}</span>
                ) : null}
              </li>
            ) : null}
            <li className="mt-auto flex items-baseline justify-between gap-2 border-t border-ink/70 pt-1 text-[11px] leading-5 font-semibold">
              <span>Suma</span>
              <span className="num">
                {formatEuros(roundMoney(groups.reduce((sum, group) => sum + group.subtotal, 0)))}
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

export function QuoteCards({
  quotes,
  summaries,
}: {
  quotes: QuoteListRow[]
  /** Each quote's groups, for the little document on its card. */
  summaries: Record<string, QuoteCardSummary>
}) {
  const [selected, setSelected] = useState<QuoteListRow | null>(null)
  const [preview, setPreview] = useState<QuotePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startLoading] = useTransition()

  function open(quote: QuoteListRow) {
    setSelected(quote)
    setPreview(null)
    setError(null)
    startLoading(async () => {
      const result = await loadQuotePreview(quote.id)
      if ('error' in result) setError(result.error)
      else setPreview(result.preview)
    })
  }

  return (
    <>
      {quotes.map((quote) => (
        <li key={quote.id}>
          <article className="group relative flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-faint/70 hover:shadow-pop">
            <div className="flex items-center gap-2">
              <span className="num truncate text-xs font-semibold text-muted">{quote.reference}</span>
              <StatusBadge status={quote.status} />
              <Tooltip label={quote.status === 'draft' ? 'Editar' : 'Abrir'}>
                <Link
                  href={`/admin/quotes/${quote.id}`}
                  aria-label={`${quote.status === 'draft' ? 'Editar' : 'Abrir'} ${quote.reference}`}
                  className="relative z-10 ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  <PencilIcon />
                </Link>
              </Tooltip>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="line-clamp-2 text-sm font-semibold text-ink">{quote.title}</h3>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                <svg {...ICON} width={12} height={12}>
                  <circle cx="8" cy="5.4" r="2.6" />
                  <path d="M2.8 13.6c.6-2.4 2.7-3.8 5.2-3.8s4.6 1.4 5.2 3.8" />
                </svg>
                <span className="truncate">{quote.clientName ?? 'Sin cliente'}</span>
              </p>
            </div>

            <MiniDocument summary={summaries[quote.id]} />

            <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-soft pt-3">
              <div className="flex flex-col">
                <span className="num text-xl font-semibold -tracking-[0.02em] text-ink">
                  {formatEuros(payable(quote.totals))}
                </span>
                <span className="text-2xs text-faint">
                  {quote.totals.vatRate === null ? 'sin IVA' : `con IVA ${formatVatRate(quote.totals.vatRate)}`}
                </span>
              </div>
              <div className="flex flex-col items-end text-2xs text-muted">
                <span>{plural(quote.lineCount, 'línea', 'líneas')}</span>
                <span className="num">
                  {quote.validUntil ? `Válido hasta ${date(quote.validUntil)}` : `Creado ${date(quote.createdAt)}`}
                </span>
              </div>
            </div>

            {/* The whole card opens the preview; the pencil above sits on top of it. */}
            <button
              type="button"
              onClick={() => open(quote)}
              aria-label={`Vista previa de ${quote.reference}, ${quote.title}`}
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
          eyebrow={
            <>
              <span className="num font-semibold">{selected.reference}</span>
              <StatusBadge status={selected.status} />
            </>
          }
          title={selected.title}
          meta={
            <>
              <span>{selected.clientName ?? 'Sin cliente'}</span>
              {selected.projectReference ? <span className="num">Proyecto {selected.projectReference}</span> : null}
            </>
          }
          actions={
            <>
              <a href={`/admin/quotes/${selected.id}/pdf`} target="_blank" rel="noreferrer" className={SECONDARY}>
                <svg {...ICON}>
                  <path d="M9.4 2.4H4.6a1 1 0 0 0-1 1v9.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V5.4Z" />
                  <path d="M9.4 2.4v3h3" />
                </svg>
                PDF
              </a>
              {selected.status !== 'draft' ? (
                <a href={`/q/${selected.accessToken}`} target="_blank" rel="noreferrer" className={SECONDARY}>
                  <svg {...ICON}>
                    <path d="M3 8s2-3.6 5-3.6S13 8 13 8s-2 3.6-5 3.6S3 8 3 8Z" />
                    <circle cx="8" cy="8" r="1.4" />
                  </svg>
                  Ver como cliente
                </a>
              ) : null}
              <Link href={`/admin/quotes/${selected.id}`} className={PRIMARY}>
                <PencilIcon />
                {selected.status === 'draft' ? 'Editar presupuesto' : 'Abrir presupuesto'}
              </Link>
            </>
          }
        >
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : preview ? (
            <QuotePreviewBody preview={preview} />
          ) : (
            <PreviewSkeleton />
          )}
        </PreviewDialog>
      ) : null}
    </>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xs font-medium tracking-[0.05em] text-faint uppercase">{label}</span>
      <span className={`num text-sm font-medium ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  )
}

function QuotePreviewBody({ preview }: { preview: QuotePreview }) {
  const { totals } = preview
  const payableTotal = totals.vatRate === null ? totals.grand : totals.withVat

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl bg-surface-sunk p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-muted">
            {totals.vatRate === null ? 'Total (IVA no incluido)' : 'Total con IVA'}
          </span>
          <span className="num text-2xl font-semibold -tracking-[0.02em]">{formatEuros(payableTotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Base" value={formatEuros(totals.grand)} />
          <Figure
            label={totals.vatRate === null ? 'IVA' : `IVA ${formatVatRate(totals.vatRate)}`}
            value={totals.vatRate === null ? '—' : formatEuros(totals.vat)}
          />
          <Figure label="Coste" value={formatEuros(totals.cost)} />
          <Figure label="Margen" value={formatEuros(totals.margin)} tone={totals.margin < 0 ? 'danger' : 'success'} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">
          {plural(preview.groups.length, 'grupo', 'grupos')} · {plural(preview.lineCount, 'línea', 'líneas')}
        </h3>
        {preview.groups.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tiene líneas.</p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line">
            {preview.groups.map((group) => (
              <li key={group.name} className="flex items-center gap-3 border-b border-line-soft px-3 py-2.5 last:border-0">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</span>
                {group.display !== 'detailed' ? (
                  <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-2xs text-muted">
                    {GROUP_DISPLAY_LABELS[group.display]}
                  </span>
                ) : null}
                <span className="text-2xs text-faint">{plural(group.lineCount, 'línea', 'líneas')}</span>
                <span className="num w-24 text-right text-sm font-medium">{formatEuros(group.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview.extras.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-[0.04em] text-muted uppercase">Extras opcionales</h3>
          <ul className="overflow-hidden rounded-xl border border-line">
            {preview.extras.map((extra, index) => (
              <li key={`${extra.name}-${index}`} className="flex items-center gap-3 border-b border-line-soft px-3 py-2.5 last:border-0">
                <span
                  aria-hidden="true"
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    extra.selected ? 'border-primary bg-primary text-primary-ink' : 'border-line'
                  }`}
                >
                  {extra.selected ? (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3.6 8.4 3 3 5.8-6.4" />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{extra.name}</span>
                <span className="sr-only">{extra.selected ? 'Marcado por el cliente' : 'No marcado'}</span>
                <span className="num text-sm text-muted">{formatEuros(extra.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview.signedName ? (
        <p className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          Firmado por {preview.signedName}.
        </p>
      ) : null}
      {preview.status === 'rejected' ? (
        <p className="rounded-xl border border-line bg-surface-sunk px-4 py-3 text-sm text-muted">
          El cliente lo rechazó{preview.rejectionReason ? `: «${preview.rejectionReason}»` : '.'}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-2xs text-faint">Cliente</dt>
          <dd className="truncate">
            {preview.client ? (
              <Link href={`/admin/clients/${preview.client.id}`} className="text-accent hover:underline">
                {preview.client.fullName}
              </Link>
            ) : (
              'Sin cliente'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Creado</dt>
          <dd className="num">{date(preview.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Enviado</dt>
          <dd className="num">{date(preview.sentAt)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Válido hasta</dt>
          <dd className="num">{date(preview.validUntil)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Inicio previsto</dt>
          <dd className="num">{date(preview.startDatePlanned)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Proyecto</dt>
          <dd className="num">{preview.projectReference ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
