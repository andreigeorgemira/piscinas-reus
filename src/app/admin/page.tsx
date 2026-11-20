import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { NewQuoteButton } from '@/app/admin/quotes/new-quote-dialog'
import { StatusBadge } from '@/app/admin/quotes/status-badge'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listClientOptions } from '@/lib/clients/queries'
import { roundMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { formatEuros } from '@/lib/price-book/decimal'
import { listQuotes, type QuoteListRow } from '@/lib/quotes/queries'
import { getCompanySettings } from '@/lib/settings/queries'
import { PageHeader } from './page-header'

export const metadata: Metadata = { title: 'Panel' }

/** How many quotes of one status the panel reads to add up their value. */
const SUMMED = 100

/** A quote waiting this many days for an answer is worth a call. */
const CHASE_AFTER_DAYS = 7

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
}

function sumOf(quotes: QuoteListRow[]): number {
  return roundMoney(quotes.reduce((sum, quote) => sum + quote.totals.grandTotal, 0))
}

function Kpi({
  href,
  label,
  value,
  note,
  tone,
  icon,
}: {
  href: string
  label: string
  value: string
  note: string
  tone: 'neutral' | 'accent' | 'success' | 'warn'
  icon: ReactNode
}) {
  const toneClass = {
    neutral: 'bg-surface-sunk text-muted',
    accent: 'bg-accent-soft text-accent',
    success: 'bg-success-soft text-success',
    warn: 'bg-warn-soft text-warn',
  }[tone]

  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-3.5 rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-faint/60 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <svg {...ICON_PROPS}>{icon}</svg>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="num pt-0.5 text-2xl font-semibold -tracking-[0.02em] text-ink">{value}</span>
        <span className="num truncate pt-0.5 text-2xs text-faint">{note}</span>
      </span>
    </Link>
  )
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <header className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action ? <span className="ml-auto">{action}</span> : null}
      </header>
      {children}
    </section>
  )
}

function QuoteLine({ quote, aside }: { quote: QuoteListRow; aside: ReactNode }) {
  return (
    <li className="border-b border-line-soft last:border-0">
      <Link
        href={`/admin/quotes/${quote.id}`}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="num shrink-0 text-xs font-semibold whitespace-nowrap text-ink">{quote.reference}</span>
            <span className="truncate text-xs text-muted">{quote.clientName ?? 'Sin cliente'}</span>
          </span>
          <span className="truncate text-sm text-ink-soft">{quote.title}</span>
        </span>
        {aside}
      </Link>
    </li>
  )
}

/**
 * Where a working day starts: what is waiting on the office, what is waiting on
 * clients, and the button that starts the next quote.
 *
 * Values are the quotes' totals before VAT, the figure the margin is measured
 * against, summed over the latest SUMMED quotes of each status -- a small firm
 * never reaches it, and a large one would want a report rather than a tile.
 */
export default async function AdminHomePage() {
  const supabase = await requireAdmin()
  const now = new Date()

  const [drafts, sent, accepted, clients, clientOptions, settings, recent] = await Promise.all([
    listQuotes(supabase, { status: 'draft', pageSize: SUMMED }),
    listQuotes(supabase, { status: 'sent', pageSize: SUMMED }),
    listQuotes(supabase, { status: 'accepted', pageSize: SUMMED }),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => count ?? 0),
    listClientOptions(supabase),
    getCompanySettings(supabase),
    listQuotes(supabase, { pageSize: 6 }),
  ])

  const waiting = [...sent.quotes].sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? '')).slice(0, 6)
  const toChase = sent.quotes.filter((quote) => (daysSince(quote.sentAt, now) ?? 0) >= CHASE_AFTER_DAYS).length

  const longDate = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  }).format(now)
  // "Viernes, 20 de noviembre": only the first letter, as Spanish writes it.
  const today = longDate.charAt(0).toUpperCase() + longDate.slice(1)

  return (
    <>
      <PageHeader title="Panel" meta={today}>
        <NewQuoteButton clients={clientOptions} defaultVatRate={settings.defaultVatRate} />
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <li>
              <Kpi
                href="/admin/quotes?status=draft"
                label="En borrador"
                value={String(drafts.total)}
                note={drafts.total > 0 ? `${formatEuros(sumOf(drafts.quotes))} por enviar` : 'Nada a medias'}
                tone="neutral"
                icon={<path d="M10.6 2.8 13.2 5.4 5.8 12.8H3.2v-2.6Z" />}
              />
            </li>
            <li>
              <Kpi
                href="/admin/quotes?status=sent"
                label="Esperando respuesta"
                value={String(sent.total)}
                note={sent.total > 0 ? `${formatEuros(sumOf(sent.quotes))} en juego` : 'Ninguno pendiente'}
                tone={toChase > 0 ? 'warn' : 'accent'}
                icon={
                  <>
                    <path d="M13.6 2.6 7.4 8.8" />
                    <path d="M13.6 2.6 9.6 13.4l-2.2-4.6-4.6-2.2Z" />
                  </>
                }
              />
            </li>
            <li>
              <Kpi
                href="/admin/quotes?status=accepted"
                label="Aceptados"
                value={String(accepted.total)}
                note={accepted.total > 0 ? `${formatEuros(sumOf(accepted.quotes))} firmados` : 'Todavía ninguno'}
                tone="success"
                icon={<path d="m3.2 8.4 3.2 3.2 6.4-6.8" />}
              />
            </li>
            <li>
              <Kpi
                href="/admin/clients"
                label="Clientes"
                value={String(clients)}
                note="Fichas de contacto"
                tone="neutral"
                icon={
                  <>
                    <circle cx="8" cy="5.4" r="2.6" />
                    <path d="M2.8 13.6c.6-2.4 2.7-3.8 5.2-3.8s4.6 1.4 5.2 3.8" />
                  </>
                }
              />
            </li>
          </ul>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Esperando respuesta del cliente"
              action={
                sent.total > 0 ? (
                  <Link href="/admin/quotes?status=sent" className="text-xs font-medium text-accent hover:underline">
                    Ver todos
                  </Link>
                ) : null
              }
            >
              {waiting.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  Ningún presupuesto espera respuesta.
                </p>
              ) : (
                <ul>
                  {waiting.map((quote) => {
                    const days = daysSince(quote.sentAt, now)
                    const late = (days ?? 0) >= CHASE_AFTER_DAYS
                    return (
                      <QuoteLine
                        key={quote.id}
                        quote={quote}
                        aside={
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="num text-sm font-medium">{formatEuros(quote.totals.grandTotal)}</span>
                            <span className={`text-2xs ${late ? 'font-medium text-warn' : 'text-faint'}`}>
                              {days === null ? '' : days === 0 ? 'Enviado hoy' : `Hace ${plural(days, 'día', 'días')}`}
                              {late ? ' · llamar' : ''}
                            </span>
                          </span>
                        }
                      />
                    )
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title="Últimos presupuestos"
              action={
                <Link href="/admin/quotes" className="text-xs font-medium text-accent hover:underline">
                  Ver todos
                </Link>
              }
            >
              {recent.quotes.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  Todavía no hay presupuestos. Crea el primero con el botón de arriba.
                </p>
              ) : (
                <ul>
                  {recent.quotes.map((quote) => (
                    <QuoteLine
                      key={quote.id}
                      quote={quote}
                      aside={
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <StatusBadge status={quote.status} />
                          <span className="num text-xs text-muted">{formatEuros(quote.totals.grandTotal)}</span>
                        </span>
                      }
                    />
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <p className="text-2xs text-faint">
            Importes sin IVA.{' '}
            {toChase > 0
              ? `${plural(toChase, 'presupuesto lleva', 'presupuestos llevan')} más de ${CHASE_AFTER_DAYS} días sin respuesta.`
              : ''}
          </p>
        </div>
      </div>
    </>
  )
}
