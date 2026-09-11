import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from './page-header'

export const metadata: Metadata = { title: 'Panel' }

/**
 * Deliberately thin. The dashboard's job today is to get staff into the one
 * screen that exists; the counts and the pending-work list belong here once
 * there are quotes and leads to count, not as placeholder tiles now.
 */
const SHORTCUTS = [
  {
    href: '/admin/price-book',
    title: 'Tarifario',
    description: 'Conceptos, grupos, coste y precio de referencia.',
  },
  {
    href: '/admin/price-book/import',
    title: 'Importar tarifario',
    description: 'Cargar o actualizar conceptos desde un CSV.',
  },
]

export default function AdminHomePage() {
  return (
    <>
      <PageHeader title="Panel" />
      <div className="flex-1 overflow-y-auto p-5">
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
