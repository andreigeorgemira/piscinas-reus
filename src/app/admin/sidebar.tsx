'use client'

import { useState } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { AdminNav } from './admin-nav'
import { SIDEBAR_COOKIE } from './sidebar-cookie'
import { UserMenu, type AdminUser } from './user-menu'

/**
 * The frame's left edge, in two widths.
 *
 * The choice is kept in a cookie rather than localStorage so the server
 * renders the sidebar at the width the person left it at: read from
 * localStorage, the first paint would always be the expanded one and every
 * navigation would start with a jump. The cookie is a display preference and
 * carries nothing about the account, so it is not `httpOnly` and does not
 * need to be.
 */
export function Sidebar({
  defaultCollapsed,
  user,
}: {
  defaultCollapsed: boolean
  user: AdminUser
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col bg-shell text-shell-muted transition-[width] duration-150 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/*
        The toggle rides the seam between the sidebar and the page, centred
        on the brand row. Half of it hangs over the edge, which is what makes
        it read as a handle on the sidebar rather than as one more item
        inside it -- and it costs the nav no room when collapsed.
      */}
      <Tooltip label={collapsed ? 'Expandir menú' : 'Contraer menú'} side="right">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!collapsed}
          className="absolute top-[18px] -right-2.5 z-20 flex size-5 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-card transition-colors hover:border-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={collapsed ? 'rotate-180' : ''}
          >
            <path d="M10 3.6 5.6 8l4.4 4.4" />
          </svg>
        </button>
      </Tooltip>

      <div
        className={`flex h-14 shrink-0 items-center border-b border-shell-line ${
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-shell-active">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 13.8c1.1 0 1.1 1.1 2.2 1.1s1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1 1.1 1.1 2.2 1.1 1.1-1.1 2.2-1.1" />
            <path d="M6 12.2V5.6a1.6 1.6 0 0 1 3.2 0" />
            <path d="M13.4 12.2V4.8" />
            <path d="M13.4 8.6H9.2" />
          </svg>
        </span>
        {collapsed ? null : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold -tracking-[0.01em] text-shell-ink">
              Piscinas Reus
            </span>
            <span className="text-2xs text-shell-faint">Panel interno</span>
          </span>
        )}
      </div>

      <AdminNav collapsed={collapsed} />

      <div className="mt-auto border-t border-shell-line p-2">
        <UserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  )
}
