import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { LOCAL_ANON_KEY, LOCAL_URL, adminDb, createUser, resetDatabase, uniqueEmail } from './helpers/db'

beforeAll(resetDatabase)
afterAll(resetDatabase)

/**
 * Creates a confirmed auth user carrying attacker-supplied signup metadata
 * and returns a client authenticated as them. Calls
 * `admin.createUser({ user_metadata: ... })` directly rather than
 * extending the shared `createUser()` helper, per the review finding: the
 * helper's `(email, password)` signature is used unchanged by six other
 * test files, and this metadata parameter is only ever needed here.
 */
async function createUserWithMetadata(
  email: string,
  metadata: Record<string, unknown>,
): Promise<{ id: string; db: SupabaseClient }> {
  const password = 'test-password-123'
  const { data, error } = await adminDb().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error

  const db = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error

  return { id: data.user!.id, db }
}

describe('account linking', () => {
  it('creates a profile with the client role', async () => {
    const { id } = await createUser(uniqueEmail('newcomer'))
    const { data } = await adminDb().from('profiles').select().eq('id', id).single()
    expect(data!.role).toBe('client')
  })

  it('lets current_client_id resolve the linked record', async () => {
    const { id, db } = await createUser(uniqueEmail('resolver'))
    const { data: client } = await adminDb()
      .from('clients')
      .select()
      .eq('user_id', id)
      .single()

    const { data } = await db.rpc('current_client_id')
    expect(data).toBe(client!.id)
  })

  it('creates a client row for a brand new registration', async () => {
    const email = uniqueEmail('fresh')
    const { id } = await createUser(email)
    const { data } = await adminDb().from('clients').select().eq('user_id', id).single()
    expect(data!.email.toLowerCase()).toBe(email.toLowerCase())
  })

  it('adopts a client record that staff created earlier', async () => {
    const email = uniqueEmail('quoted-first')
    const { data: existing } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Presupuestado antes' })
      .select()
      .single()
    expect(existing!.user_id).toBeNull()

    const { id } = await createUser(email)

    const { data: linked } = await adminDb()
      .from('clients')
      .select()
      .eq('id', existing!.id)
      .single()
    expect(linked!.user_id).toBe(id)
    expect(linked!.full_name).toBe('Presupuestado antes')
  })

  it('matches the existing record regardless of letter case', async () => {
    const email = uniqueEmail('MixedCase')
    await adminDb().from('clients').insert({ email: email.toUpperCase(), full_name: 'Mixta' })
    const { id } = await createUser(email.toLowerCase())
    const { data } = await adminDb().from('clients').select().eq('user_id', id)
    expect(data).toHaveLength(1)
  })

  it('leaves quotes written before registration attached to the adopted record', async () => {
    const email = uniqueEmail('history')
    const { data: client } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Con historial' })
      .select()
      .single()
    await adminDb().from('quotes').insert({
      client_id: client!.id,
      reference: 'Q-2026-6001',
      title: 'Presupuesto anterior al registro',
      status: 'sent',
      access_token: 'token-history',
    })

    const { db } = await createUser(email)
    // migration 0004 dropped quotes_select_own and moved customer reads to
    // the client_quotes view (see that migration's header comment): a
    // customer session has no policy on the base `quotes` table at all.
    const { data: visible } = await db.from('client_quotes').select('reference')

    expect(visible).toHaveLength(1)
    expect(visible![0]!.reference).toBe('Q-2026-6001')
  })

  it('does not link an unconfirmed account', async () => {
    const email = uniqueEmail('unconfirmed')
    const { data, error } = await adminDb().auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: false,
    })
    expect(error).toBeNull()

    const { data: clientRows } = await adminDb().from('clients').select().eq('user_id', data!.user!.id)
    expect(clientRows).toEqual([])

    // The trigger's `if new.email_confirmed_at is null then return new`
    // guard skips both inserts, not just the clients one.
    const { data: profileRows } = await adminDb().from('profiles').select().eq('id', data!.user!.id)
    expect(profileRows).toEqual([])
  })

  it('does not steal a client already linked to somebody else', async () => {
    const email = uniqueEmail('taken')
    const first = await createUser(email)
    const { data: before } = await adminDb().from('clients').select().eq('user_id', first.id).single()

    // A second account cannot exist for the same email in Supabase auth, so
    // assert instead that the link is stable and singular.
    const { data: all } = await adminDb().from('clients').select().eq('email', email)
    expect(all).toHaveLength(1)
    expect(all![0]!.id).toBe(before!.id)
  })

  it('ignores an admin role claim in signup metadata', async () => {
    // The classic compromise point for this trigger: if the role were ever
    // read from raw_user_meta_data, this is exactly the payload an
    // attacker would send to a public signup endpoint.
    const email = uniqueEmail('attacker')
    const { id, db } = await createUserWithMetadata(email, { role: 'admin' })

    const { data: profile } = await adminDb().from('profiles').select().eq('id', id).single()
    expect(profile!.role).toBe('client')

    const { data: isAdmin } = await db.rpc('is_admin')
    expect(isAdmin).toBe(false)
  })

  it('ignores a nested admin role claim while still honoring full_name', async () => {
    // A second, differently-shaped payload, because a naive fix (e.g.
    // guarding only a bare `role` key) might miss this one. full_name is
    // asserted positively here: it proves the trigger genuinely read this
    // metadata object, so 'client' is the trigger refusing a value it can
    // see -- not the trigger failing to read metadata at all.
    const email = uniqueEmail('attacker-named')
    const { id, db } = await createUserWithMetadata(email, {
      role: 'admin',
      full_name: 'Atacante',
    })

    const { data: profile } = await adminDb().from('profiles').select().eq('id', id).single()
    expect(profile!.role).toBe('client')
    expect(profile!.full_name).toBe('Atacante')

    const { data: isAdmin } = await db.rpc('is_admin')
    expect(isAdmin).toBe(false)
  })
})
