import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { PageHeader } from './page-header'

export const metadata: Metadata = { title: 'Panel' }

const SHORTCUTS = [
  {
    href: '/admin/quotes',
    title: 'Presupuestos',
    description: 'Escribir, enviar y seguir lo que se ha ofrecido.',
  },
  {
    href: '/admin/clients',
    title: 'Clientes',
    description: 'Fichas, contacto y lo presupuestado a cada uno.',
  },
  {
    href: '/admin/price-books',
    title: 'Tarifarios',
    description: 'Los catálogos de precios: grupos, conceptos, coste y precio.',
  },
]

/**
 * Counts one status of the quote table without reading a single row.
 *
 * `head: true` asks PostgREST for the count header and no body, so a business
 * with four thousand quotes pays the same as one with four. RLS decides what is
 * counted (0003_rls_policies.sql), so this is a staff-only number by
 * construction rather than by a filter written here.
 */
async function countQuotes(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  status: string,
): Promise<number> {
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
  return count ?? 0
}

/**
 * The tiles that get staff into a screen, and the four numbers that say
 * whether anything needs them today.
 *
 * The comment this file used to carry said the counts belonged here "once there
 * are quotes and leads to count". There are quotes now. Leads are still a later
 * phase, so they are still not here.
 */
export default async function AdminHomePage() {
  const supabase = await requireAdmin()

  const [drafts, sent, accepted, clients] = await Promise.all([
    countQuotes(supabase, 'draft'),
    countQuotes(supabase, 'sent'),
    countQuotes(supabase, 'accepted'),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => count ?? 0),
  ])

  const NUMBERS = [
    { label: 'En borrador', value: drafts, href: '/admin/quotes?status=draft' },
    { label: 'Enviados, sin respuesta', value: sent, href: '/admin/quotes?status=sent' },
    { label: 'Aceptados', value: accepted, href: '/admin/quotes?status=accepted' },
    { label: 'Clientes', value: clients, href: '/admin/clients' },
  ]

  return (
    <>
      <PageHeader title="Panel" />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        <ul className="grid max-w-3xl gap-3 sm:grid-cols-4">
          {NUMBERS.map((number) => (
            <li key={number.label}>
              <Link
                href={number.href}
                className="flex h-full flex-col gap-0.5 rounded-lg border border-line bg-surface p-4 shadow-card transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="num text-2xl font-semibold -tracking-[0.02em]">
                  {number.value}
                </span>
                <span className="text-xs text-muted">{number.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.href}>
              <Link
                href={shortcut.href}
                className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface p-4 shadow-card transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="text-base font-medium">{shortcut.title}</span>
                <span className="text-xs text-muted">{shortcut.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
