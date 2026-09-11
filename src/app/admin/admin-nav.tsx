'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

type NavItem = {
  href: string
  label: string
  icon: ReactNode
}

/**
 * Only routes that exist are listed. The design shows Clientes, Presupuestos
 * and Proyectos too, and they belong here the moment phase 3 lands, but a
 * sidebar that offers a dead link teaches staff to distrust the whole thing.
 */
const ITEMS: { section: string; items: NavItem[] }[] = [
  {
    section: 'Trabajo',
    items: [
      {
        href: '/admin',
        label: 'Panel',
        icon: (
          <path d="M2.5 6.8 8 2.5l5.5 4.3v6.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8Z" />
        ),
      },
    ],
  },
  {
    section: 'Catálogo',
    items: [
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
    ],
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

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 px-2.5 pt-3.5">
      {ITEMS.map((group) => (
        <div key={group.section} className="flex flex-col gap-0.5 pb-3">
          <span className="px-2.5 pb-1.5 text-[10px] font-medium tracking-[0.08em] text-shell-faint uppercase">
            {group.section}
          </span>
          {group.items.map((item) => {
            const current = isCurrent(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-[5px] px-2.5 py-1.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  current
                    ? 'bg-shell-active font-medium text-shell-ink'
                    : 'text-shell-muted hover:bg-shell-active/60 hover:text-shell-ink'
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke={current ? 'var(--accent)' : 'currentColor'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
