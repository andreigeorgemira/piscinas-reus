import { createClient } from '@supabase/supabase-js'
import { getPublicEnv, getServerEnv } from '@/lib/env'

/**
 * Bypasses every Row Level Security policy. Server-side only, and only where
 * acting as no particular user is genuinely required. Never import this from
 * a file that also runs in the browser.
 */
export function createAdminSupabaseClient() {
  const { supabaseUrl } = getPublicEnv()
  const { serviceRoleKey } = getServerEnv()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
