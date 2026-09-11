'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Tooltip } from '@/components/ui/tooltip'

type NavItem = { href: string; label: string; icon: ReactNode }

/**
 * No sections. Two entries do not need headings over them, and the app is
 * meant to stay small enough that they never will: the moment Clientes,
 * Presupuestos and Proyectos land they join this flat list. Only routes that
 * exist are here -- a sidebar that offers a dead link teaches staff to
 * distrust the whole thing.
 */
const ITEMS: NavItem[] = [
  {
    href: '/admin',
    label: 'Panel',
    icon: <path d="M2.5 6.8 8 2.5l5.5 4.3v6.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8Z" />,
  },
  {
    href: '/admin/price-book',
    label: 'Tarifario',
    icon: (
      <>
        <path d="M8.4 1.9H3.1a1.2 1.2 0 0 0-1.2 1.2v5.3c0 .3.1.6.4.8l5.6 5.6a1.2 1.2 0 0 0 1.7 0l4.5-4.5a1.2 1.2 0 0 0 0-1.7L8.5 3a1.2 1.2 0 0 0-.1-1.1Z" />
        <circle cx="5.2" cy="5.2" r="1" />
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
function isCurrent(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2">
      {ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href)
        const link = (
          <Link
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              collapsed ? 'justify-center px-0' : 'px-2.5'
            } ${
              current
                ? 'bg-shell-active font-medium text-shell-ink'
                : 'text-shell-muted hover:bg-shell-active/60 hover:text-shell-ink'
            }`}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              stroke={current ? 'var(--accent)' : 'currentColor'}
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

        // Collapsed, the label is the tooltip's whole job: there is nothing
        // on screen but an icon. Expanded, a tooltip repeating the visible
        // word would be noise.
        return collapsed ? (
          <Tooltip key={item.href} label={item.label} side="right">
            {link}
          </Tooltip>
        ) : (
          <div key={item.href}>{link}</div>
        )
      })}
    </nav>
  )
}
