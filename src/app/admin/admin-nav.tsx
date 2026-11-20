'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Tooltip } from '@/components/ui/tooltip'

export type NavItem = { href: string; label: string; icon: ReactNode }

/**
 * One list, drawn in two places: the daily work under a single "Gestión"
 * heading, and Ajustes on its own at the foot (see AdminNav). The day
 * Proyectos lands it joins the work. Only routes that exist are here -- a
 * sidebar that offers a dead link teaches staff to distrust the whole thing.
 *
 * The order is the order of the work: a client comes in, a quote is written
 * for them, and the tarifario is what the quote is written from.
 */
export const ITEMS: NavItem[] = [
  {
    href: '/admin',
    label: 'Panel',
    icon: <path d="M2.5 6.8 8 2.5l5.5 4.3v6.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8Z" />,
  },
  {
    href: '/admin/clients',
    label: 'Clientes',
    icon: (
      <>
        <circle cx="8" cy="5.6" r="2.6" />
        <path d="M3 13.4c0-2.3 2.2-3.8 5-3.8s5 1.5 5 3.8" />
      </>
    ),
  },
  {
    href: '/admin/quotes',
    label: 'Presupuestos',
    icon: (
      <>
        <path d="M3.4 2.6h9.2v10.8H3.4Z" />
        <path d="M5.6 5.8h4.8M5.6 8h4.8M5.6 10.2h2.8" />
      </>
    ),
  },
  {
    href: '/admin/price-books',
    label: 'Tarifarios',
    icon: (
      <>
        <path d="M8.4 1.9H3.1a1.2 1.2 0 0 0-1.2 1.2v5.3c0 .3.1.6.4.8l5.6 5.6a1.2 1.2 0 0 0 1.7 0l4.5-4.5a1.2 1.2 0 0 0 0-1.7L8.5 3a1.2 1.2 0 0 0-.1-1.1Z" />
        <circle cx="5.2" cy="5.2" r="1" />
      </>
    ),
  },
  {
    href: '/admin/settings',
    label: 'Ajustes',
    icon: (
      <>
        <circle cx="8" cy="8" r="2.1" />
        <path d="M8 1.9v1.6M8 12.5v1.6M14.1 8h-1.6M3.5 8H1.9M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1M12.3 12.3l-1.1-1.1M4.8 4.8 3.7 3.7" />
      </>
    ),
  },
]

/**
 * `/admin` must not light up while you are on `/admin/price-book`, and
 * `/admin/price-book` must stay lit on `/admin/price-book/import`. Hence an
 * exact match for the dashboard root and a segment-boundary match below it -
 * `startsWith` alone would also match a future `/admin/price-book-archive`.
 */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, collapsed, current }: { item: NavItem; collapsed: boolean; current: boolean }) {
  const link = (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={`relative flex h-10 items-center gap-3 rounded-lg text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shell-accent ${
        collapsed ? 'justify-center px-0' : 'px-3'
      } ${
        current
          ? 'bg-shell-active font-medium text-shell-ink before:absolute before:top-2 before:bottom-2 before:-left-2 before:w-[3px] before:rounded-r-full before:bg-shell-accent'
          : 'text-shell-muted hover:bg-shell-active/60 hover:text-shell-ink'
      }`}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 16 16"
        fill="none"
        stroke={current ? 'var(--shell-accent)' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        {item.icon}
      </svg>
      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
    </Link>
  )

  // Collapsed, the label is the tooltip's whole job: there is nothing on
  // screen but an icon. Expanded, a tooltip repeating the visible word would
  // be noise.
  return collapsed ? (
    <Tooltip label={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

/**
 * The work on top, the settings at the foot: the screens staff live in are the
 * first thing in the column, and the one they visit once a year waits by the
 * account menu where configuration is usually looked for.
 */
export function AdminNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  const main = ITEMS.filter((item) => item.href !== '/admin/settings')
  const footer = ITEMS.filter((item) => item.href === '/admin/settings')

  return (
    <nav aria-label="Principal" className="flex min-h-0 flex-1 flex-col px-2 py-3">
      {collapsed ? null : (
        <span className="px-3 pb-1.5 text-2xs font-medium tracking-[0.08em] text-shell-faint uppercase">
          Gestión
        </span>
      )}
      <ul className="flex flex-col gap-0.5">
        {main.map((item) => (
          <li key={item.href}>
            <NavLink item={item} collapsed={collapsed} current={isCurrent(pathname, item.href)} />
          </li>
        ))}
      </ul>
      <ul className="mt-auto flex flex-col gap-0.5 pt-3">
        {footer.map((item) => (
          <li key={item.href}>
            <NavLink item={item} collapsed={collapsed} current={isCurrent(pathname, item.href)} />
          </li>
        ))}
      </ul>
    </nav>
  )
}
