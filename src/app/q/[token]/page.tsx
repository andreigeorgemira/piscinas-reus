import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatEuros } from '@/lib/price-book/decimal'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { formatQuantity } from '@/lib/quotes/quantity'
import { formatSpanishDate, readPublicQuote } from '@/lib/quotes/public'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Extras } from './extras'
import { QuoteResponse } from './response'

export const metadata: Metadata = {
  title: 'Tu presupuesto · Piscinas Reus',
  // A quote is a private document behind a token. Nothing about it belongs in
  // an index, and the token itself must never end up in one.
  robots: { index: false, follow: false },
}

/**
 * The document a client opens from the link, on any phone, with no account.
 *
 * It is the same quote the editor writes, printed the way it will be printed:
 * grouped, with a subtotal per group, the optional extras apart and tickable,
 * and the total moving as they are ticked. What it never carries is cost,
 * margin or the internal notes -- and what keeps them out is the function the
 * token opens (0015_public_quote_link.sql), not this page.
 *
 * A token that names nothing, a quote still in draft and a token rotated by a
 * reopening all end here as a 404: the page cannot tell them apart, which is
 * the point.
 */
export default async function PublicQuotePage({ params }: PageProps<'/q/[token]'>) {
  const { token } = await params

  const supabase = await createServerSupabaseClient()
  const quote = await readPublicQuote(supabase, token)

  if (!quote) {
    notFound()
  }

  const open = quote.status === 'sent'

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-5">
        <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink px-6 py-6 sm:px-8">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-ink">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--canvas)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M2 10.4c1.2-1.4 2.4-1.4 3.6 0s2.4 1.4 3.6 0 2.4-1.4 3.6 0" />
                    <path d="M2 6.4c1.2-1.4 2.4-1.4 3.6 0s2.4 1.4 3.6 0 2.4-1.4 3.6 0" />
                  </svg>
                </span>
                <span className="text-lg font-semibold -tracking-[0.02em]">Piscinas Reus</span>
              </div>
              <p className="pt-2 text-xs leading-5 text-muted">
                Construcción y mantenimiento de piscinas
                <br />
                Reus, Tarragona
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xs font-medium tracking-[0.08em] text-faint uppercase">
                Presupuesto
              </span>
              <span className="num block text-xl font-semibold -tracking-[0.02em]">
                {quote.reference}
              </span>
              <span className="num block pt-1 text-xs text-muted">
                {formatSpanishDate(quote.sentAt?.slice(0, 10) ?? null)}
              </span>
              {quote.validUntil ? (
                <span className="mt-2 inline-flex h-5 items-center rounded-full border border-warn/40 bg-warn-soft px-2 text-2xs font-medium text-warn">
                  {`Válido hasta el ${formatSpanishDate(quote.validUntil)}`}
                </span>
              ) : null}
            </div>
          </header>

          <div className="flex flex-wrap gap-8 border-b border-line-soft px-6 py-5 sm:px-8">
            {quote.client ? (
              <div className="min-w-[12rem] flex-1">
                <span className="text-2xs font-medium tracking-[0.08em] text-faint uppercase">
                  Para
                </span>
                <span className="block pt-1 text-sm font-medium">{quote.client.fullName}</span>
                {quote.client.address ? (
                  <span className="block text-xs leading-5 text-muted">
                    {quote.client.address}
                    <br />
                    {`${quote.client.postalCode ?? ''} ${quote.client.city ?? ''}`.trim()}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="min-w-[12rem] flex-1">
              <span className="text-2xs font-medium tracking-[0.08em] text-faint uppercase">
                Trabajo
              </span>
              <span className="block pt-1 text-sm font-medium">{quote.title}</span>
              {quote.startDatePlanned ? (
                <span className="num block text-xs text-muted">
                  {`Inicio previsto: ${formatSpanishDate(quote.startDatePlanned)}`}
                </span>
              ) : null}
            </div>
          </div>

          <div className="px-6 py-5 sm:px-8">
            {quote.groups.map((group) => (
              <section key={group.name} className="pb-5 last:pb-0">
                <div className="flex items-baseline gap-3 border-b border-ink pb-1.5">
                  <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">
                    {group.name}
                  </h2>
                  <span className="num ml-auto text-sm font-medium">
                    {formatEuros(group.subtotal)}
                  </span>
                </div>

                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-soft py-2 last:border-0"
                  >
                    <span className="min-w-[10rem] flex-1 text-sm">
                      {item.name}
                      {item.description ? (
                        <span className="block text-2xs text-muted">{item.description}</span>
                      ) : null}
                    </span>
                    <span className="num w-24 text-right text-xs text-muted">
                      {`${formatQuantity(item.quantity)} ${UNIT_LABELS[item.unit]}`}
                    </span>
                    <span className="num w-24 text-right text-xs text-muted">
                      {formatEuros(item.unitPrice)}
                    </span>
                    <span className="num w-24 text-right text-sm font-medium">
                      {formatEuros(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </section>
            ))}

            <div className="flex items-baseline gap-3 border-t-2 border-ink pt-3">
              <span className="text-sm font-medium">Suma de los trabajos</span>
              <span className="num ml-auto text-base font-semibold">
                {formatEuros(quote.totals.baseTotal)}
              </span>
            </div>
          </div>
        </article>

        {quote.extras.length > 0 ? (
          <Extras token={token} extras={quote.extras} editable={open} />
        ) : null}

        <section className="flex flex-wrap items-end gap-4 rounded-xl bg-ink px-6 py-5">
          <div className="flex-1">
            <span className="text-2xs font-medium tracking-[0.08em] text-shell-muted uppercase">
              {quote.extras.length > 0 ? 'Total con lo que has marcado' : 'Total'}
            </span>
            <span className="num block pt-0.5 text-2xl font-semibold -tracking-[0.02em] text-shell-ink">
              {formatEuros(quote.totals.grandTotal)}
            </span>
            <span className="block pt-1 text-2xs text-shell-muted">IVA no incluido.</span>
          </div>

          <a
            href={`/q/${token}/pdf`}
            className="flex h-10 items-center gap-2 rounded-lg border border-shell-line px-4 text-xs font-medium text-shell-ink transition-colors hover:bg-shell-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 2.6v7.2" />
              <path d="M5.2 7l2.8 2.8L10.8 7" />
              <path d="M2.8 11.4v1.2a.8.8 0 0 0 .8.8h8.8a.8.8 0 0 0 .8-.8v-1.2" />
            </svg>
            Descargar en PDF
          </a>
        </section>

        {quote.clientNotes ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Condiciones</h2>
            <p className="pt-1.5 text-xs leading-5 whitespace-pre-line text-ink-soft">
              {quote.clientNotes}
            </p>
          </section>
        ) : null}

        {open ? <QuoteResponse token={token} total={quote.totals.grandTotal} /> : null}

        {quote.status === 'accepted' ? (
          <section className="rounded-xl border border-success/40 bg-success-soft p-5">
            <h2 className="text-sm font-semibold text-success">Presupuesto aceptado</h2>
            <p className="pt-1 text-xs text-ink-soft">
              {quote.signedName
                ? `Firmado por ${quote.signedName} el ${formatSpanishDate(quote.signedAt?.slice(0, 10) ?? null)}.`
                : 'Aceptado.'}
              {' Nos pondremos en contacto contigo para concretar fechas.'}
            </p>
          </section>
        ) : null}

        {quote.status === 'rejected' ? (
          <section className="rounded-xl border border-line bg-surface-sunk p-5">
            <h2 className="text-sm font-semibold">Respuesta enviada</h2>
            <p className="pt-1 text-xs text-muted">
              Has dicho que no te interesa. Gracias por contestar; si cambias de idea, escríbenos.
            </p>
            {quote.rejectionReason ? (
              <p className="pt-2 text-xs text-ink-soft italic">«{quote.rejectionReason}»</p>
            ) : null}
          </section>
        ) : null}

        <p className="pb-4 text-center text-2xs text-faint">
          Las cantidades pueden ajustarse tras el replanteo en obra; cualquier cambio se comunica
          antes de ejecutarlo.
        </p>
      </div>
    </main>
  )
}
