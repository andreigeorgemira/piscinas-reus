import { signOut } from '@/app/auth/actions'
import { ThemeToggle } from '@/app/theme'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminNav } from './admin-nav'

/**
 * The frame every admin screen renders inside: a fixed sidebar on the left,
 * the page's own header and content on the right.
 *
 * The brand block and the page header are both h-14 and both carry a bottom
 * border, so the two rules meet across the seam and the screen reads as one
 * bar rather than two that nearly line up.
 *
 * The sidebar is server-rendered so the signed-in address and the sign-out
 * action need no client bundle; only the nav and the theme control are
 * Client Components, because one reads the pathname and the other reads
 * localStorage.
 *
 * This does not gate anything. The route guard in
 * src/lib/supabase/middleware.ts and requireAdmin in each page are the two
 * places that decide who gets in; a layout that redirected as well would
 * simply be a third copy of the same rule to keep in sync.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email ?? ''
  // Two letters from the address, so the avatar means something even before
  // profiles.full_name is filled in.
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <aside className="flex w-60 shrink-0 flex-col bg-shell text-shell-muted">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-shell-line px-4">
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
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold -tracking-[0.01em] text-shell-ink">
              Piscinas Reus
            </span>
            <span className="text-2xs text-shell-faint">Panel interno</span>
          </span>
        </div>

        <AdminNav />

        <div className="mt-auto flex flex-col gap-3 border-t border-shell-line p-3">
          <ThemeToggle />
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-shell-active text-2xs font-semibold text-shell-ink"
            >
              {initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs text-shell-ink" title={email}>
                {email}
              </span>
              <span className="text-2xs text-shell-faint">Administrador</span>
            </span>
            <form action={signOut} className="ml-auto">
              <button
                type="submit"
                className="flex h-7 items-center rounded-md border border-shell-line px-2.5 text-xs text-shell-muted hover:bg-shell-active hover:text-shell-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
