import { signOut } from '@/app/auth/actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminNav } from './admin-nav'

/**
 * The frame every admin screen renders inside: a fixed sidebar on the left,
 * the page's own header and content on the right.
 *
 * The sidebar is server-rendered so the signed-in address and the sign-out
 * action need no client bundle; only the nav itself is a Client Component,
 * because deciding which entry is current means reading the pathname.
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
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="flex w-[236px] shrink-0 flex-col bg-shell text-shell-muted">
        <div className="flex items-center gap-2.5 border-b border-shell-line px-4 pt-4 pb-3.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 14c1.1 0 1.1 1.1 2.2 1.1S5.8 14 6.9 14s1.1 1.1 2.2 1.1S10.2 14 11.3 14s1.1 1.1 2.2 1.1S14.6 14 15.7 14s1.1 1.1 1.8 1.1" />
            <path d="M6 12.4V5.6a1.6 1.6 0 0 1 3.2 0" />
            <path d="M13.4 12.4V4.8" />
            <path d="M13.4 8.6H9.2" />
          </svg>
          <span className="flex flex-col gap-px">
            <span className="text-[13px] font-semibold -tracking-[0.01em] text-shell-ink">
              Piscinas Reus
            </span>
            <span className="text-[10.5px] text-shell-faint">Panel interno</span>
          </span>
        </div>

        <AdminNav />

        <div className="mt-auto flex items-center gap-2.5 border-t border-shell-line px-2.5 py-3">
          <span
            aria-hidden="true"
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[5px] bg-shell-active text-[11px] font-semibold text-shell-ink"
          >
            {initials}
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-[11.5px] text-shell-ink" title={email}>
              {email}
            </span>
            <span className="text-[10.5px] text-shell-faint">Administrador</span>
          </span>
          <form action={signOut} className="ml-auto">
            <button
              type="submit"
              className="rounded-[5px] border border-shell-line px-2 py-1 text-[11.5px] text-shell-muted hover:bg-shell-active hover:text-shell-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Salir
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
