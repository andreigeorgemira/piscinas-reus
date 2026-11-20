'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandMark } from '@/components/ui/brand-mark'
import { isCurrent, ITEMS } from './admin-nav'
import { UserMenu, type AdminUser } from './user-menu'

/**
 * On a phone the sidebar would take a third of the screen, so below `md` it
 * gives way to these two: a slim bar on top with the company and the account,
 * and the sections along the bottom, where a thumb reaches them.
 */
export function MobileTopBar({ tradeName, user }: { tradeName: string; user: AdminUser }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-surface px-4 md:hidden">
      <BrandMark name={tradeName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tradeName}</span>
      <div className="w-12">
        <UserMenu user={user} collapsed />
      </div>
    </div>
  )
}

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
              current ? 'text-ink' : 'text-faint'
            }`}
          >
            <span
              className={`flex h-6 w-10 items-center justify-center rounded-full transition-colors ${
                current ? 'bg-accent-soft' : ''
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
