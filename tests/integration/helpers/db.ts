import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Fixed local development credentials printed by `supabase start`. They are
 * identical on every machine and grant access to nothing but the local
 * container, so committing them is intentional.
 */
export const LOCAL_URL = 'http://127.0.0.1:54321'
export const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const LOCAL_ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/** Service-role client. Bypasses RLS. Use it only to arrange fixtures. */
export function adminDb(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Anonymous client. Exactly what an unauthenticated visitor gets. */
export function anonDb(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Creates a confirmed auth user and returns a client authenticated as them.
 * Confirming immediately mirrors production, where the account-linking
 * trigger only fires once the email is verified.
 */
export async function createUser(
  email: string,
  password = 'test-password-123',
): Promise<{ id: string; db: SupabaseClient }> {
  const admin = adminDb()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const db = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error

  return { id: data.user.id, db }
}

/** Promotes a user to the admin role. */
export async function makeAdmin(userId: string): Promise<void> {
  const { error } = await adminDb()
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId)
  if (error) throw error
}

/** Deletes every row created by tests, in foreign-key-safe order. */
export async function resetDatabase(): Promise<void> {
  const admin = adminDb()
  for (const table of [
    'quote_items',
    'quotes',
    'projects',
    'leads',
    'price_book_items',
    'price_book_groups',
    'clients',
  ]) {
    const { error } = await admin
      .from(table)
      .delete()
      .gte('created_at', '1900-01-01')
    if (error && error.code !== 'PGRST116') throw error
  }
  const { data } = await admin.auth.admin.listUsers()
  for (const user of data?.users ?? []) {
    await admin.auth.admin.deleteUser(user.id)
  }
}

/** Unique email per test run, so parallel runs never collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}
