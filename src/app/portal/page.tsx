import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/auth/actions'
import {
  listPortalProjects,
  listPortalQuotes,
  PORTAL_QUOTE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
} from '@/lib/portal/queries'
import { formatEuros } from '@/lib/price-book/decimal'
import { formatSpanishDate } from '@/lib/quotes/public'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mi área' }

const STATUS_TONE = {
  sent: 'border-accent/40 bg-accent-soft text-accent',
  accepted: 'border-success/40 bg-success-soft text-success',
  rejected: 'border-line bg-surface-sunk text-muted',
} as const

/**
 * The client's own area: the quotes they have been sent and the work that came
 * of them. Each quote opens its own page (/q/<token>), where it is read,
 * chosen, signed or declined -- this screen lists, it does not duplicate that.
 */
export default async function PortalHomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [quotes, projects] = await Promise.all([listPortalQuotes(supabase), listPortalProjects(supabase)])

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:py-12">
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold -tracking-[0.02em]">Mi área</h1>
            <p className="pt-1 text-xs text-muted">Sesión iniciada como {user?.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink-soft hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Salir
            </button>
          </form>
        </header>

        <section aria-labelledby="portal-quotes" className="rounded-xl border border-line bg-surface shadow-card">
          <h2 id="portal-quotes" className="border-b border-line-soft px-5 py-4 text-sm font-semibold">
            Tus presupuestos
          </h2>
          {quotes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">Todavía no te hemos enviado ningún presupuesto.</p>
          ) : (
            <ul>
              {quotes.map((quote) => (
                <li key={quote.id} className="border-b border-line-soft last:border-0">
                  <Link
                    href={`/q/${quote.accessToken}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="min-w-[12rem] flex-1">
                      <span className="num block text-xs text-muted">{quote.reference}</span>
                      <span className="block text-sm font-medium">{quote.title}</span>
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${STATUS_TONE[quote.status]}`}
                    >
                      {PORTAL_QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                    <span className="num w-32 text-right">
                      <span className="block text-sm font-semibold">{formatEuros(quote.total)}</span>
                      <span className="block text-2xs text-faint">
                        {quote.vatIncluded ? 'IVA incluido' : 'IVA no incluido'}
                      </span>
                    </span>
                    {quote.status === 'sent' && quote.validUntil ? (
                      <span className="num w-full text-2xs text-muted sm:w-auto">
                        {`Válido hasta el ${formatSpanishDate(quote.validUntil)}`}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="portal-projects" className="rounded-xl border border-line bg-surface shadow-card">
          <h2 id="portal-projects" className="border-b border-line-soft px-5 py-4 text-sm font-semibold">
            Tus obras
          </h2>
          {projects.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              Cuando aceptes un presupuesto, la obra aparecerá aquí.
            </p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft px-5 py-3 last:border-0"
                >
                  <span className="min-w-[12rem] flex-1">
                    <span className="num block text-xs text-muted">{project.reference}</span>
                    <span className="block text-sm font-medium">{project.name}</span>
                  </span>
                  <span className="text-xs text-ink-soft">{PROJECT_STATUS_LABELS[project.status]}</span>
                  {project.startDatePlanned ? (
                    <span className="num text-2xs text-muted">
                      {`Inicio previsto: ${formatSpanishDate(project.startDatePlanned)}`}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
