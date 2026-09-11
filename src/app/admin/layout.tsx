import { cookies } from 'next/headers'
import { AdminProviders } from '@/components/ui/providers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar } from './sidebar'
import { SIDEBAR_COOKIE } from './sidebar-cookie'
import type { AdminUser } from './user-menu'

/**
 * The frame every admin screen renders inside: a sidebar on the left, the
 * page's own header and content on the right.
 *
 * The brand block and the page header are both h-14 and both carry a bottom
 * border, so the two rules meet across the seam and the screen reads as one
 * bar rather than two that nearly line up.
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

  // The profile carries the name and the role the sidebar shows. A missing
  // row is not an error worth a broken screen: the menu falls back to the
  // address, which is always there.
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name, phone, role').eq('id', user.id).single()
    : { data: null }

  const adminUser: AdminUser = {
    email: user?.email ?? '',
    fullName: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    role: profile?.role ?? 'admin',
  }

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed'

  return (
    <AdminProviders>
      <div className="flex h-screen overflow-hidden bg-canvas text-ink">
        <Sidebar defaultCollapsed={collapsed} user={adminUser} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </AdminProviders>
  )
}
