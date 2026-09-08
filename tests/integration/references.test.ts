import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient

beforeAll(async () => {
  await resetDatabase()
  await adminDb().from('reference_counters').delete().gte('year', 0)
  const boss = await createUser(uniqueEmail('staff'))
  // The trigger that creates a profiles row on signup does not exist until
  // Task 9 (see tests/integration/auth-helpers.test.ts), so the row is
  // inserted here rather than assumed to exist.
  await adminDb().from('profiles').insert({ id: boss.id })
  await makeAdmin(boss.id)
  staff = boss.db
})

afterAll(async () => {
  await adminDb().from('reference_counters').delete().gte('year', 0)
  await resetDatabase()
})

describe('next_reference', () => {
  it('formats the reference with prefix, year and four digits', async () => {
    const { data } = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const year = new Date().getFullYear()
    expect(data).toBe(`Q-${year}-0001`)
  })

  it('increments on each call', async () => {
    const second = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const third = await staff.rpc('next_reference', { p_prefix: 'Q' })
    const year = new Date().getFullYear()
    expect(second.data).toBe(`Q-${year}-0002`)
    expect(third.data).toBe(`Q-${year}-0003`)
  })

  it('counts each prefix separately', async () => {
    const { data } = await staff.rpc('next_reference', { p_prefix: 'P' })
    const year = new Date().getFullYear()
    expect(data).toBe(`P-${year}-0001`)
  })

  it('never issues the same reference twice under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => staff.rpc('next_reference', { p_prefix: 'C' })),
    )
    const values = results.map((r) => r.data as string)
    expect(new Set(values).size).toBe(25)
  })

  it('rejects an anonymous caller', async () => {
    // Note: this does not exercise a grant-layer ("permission denied for
    // function") rejection. Supabase's default privileges grant EXECUTE on
    // every public-schema function directly to anon/authenticated/
    // service_role at creation time; `revoke all ... from public` in the
    // migration only revokes the PUBLIC pseudo-role's grant, which those
    // per-role default grants never went through, so it does not remove
    // them. In practice this anonymous call is refused by the same
    // is_admin() check inside next_reference as every other non-admin
    // caller - see the test below for the assertion that pins that down.
    const { createClient } = await import('@supabase/supabase-js')
    const { LOCAL_URL, LOCAL_ANON_KEY } = await import('./helpers/db')
    const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY)
    const { error } = await anon.rpc('next_reference', { p_prefix: 'Q' })
    expect(error).not.toBeNull()
  })

  it('rejects a signed-in non-admin without advancing the counter', async () => {
    const year = new Date().getFullYear()
    const customer = await createUser(uniqueEmail('customer'))
    // See the beforeAll comment: the signup trigger doesn't exist until
    // Task 9, so the profiles row is inserted manually. No makeAdmin() call
    // here - this user must stay a non-admin.
    await adminDb().from('profiles').insert({ id: customer.id })

    const before = await adminDb()
      .from('reference_counters')
      .select('last_value')
      .eq('prefix', 'NOADMIN')
      .eq('year', year)
      .maybeSingle()

    const { data, error } = await customer.db.rpc('next_reference', { p_prefix: 'NOADMIN' })

    expect(data).toBeNull()
    // Assert on the specific failure so this test cannot be satisfied by a
    // different, unrelated rejection (e.g. a foreign-key or RLS error): this
    // must be the errcode 42501 raised explicitly by the is_admin() check
    // inside next_reference, with its exact message.
    expect(error?.code).toBe('42501')
    expect(error?.message).toBe('Only staff may allocate references')

    const after = await adminDb()
      .from('reference_counters')
      .select('last_value')
      .eq('prefix', 'NOADMIN')
      .eq('year', year)
      .maybeSingle()

    // The rejection must happen before the insert/update, so there should be
    // no row at all, and certainly no change in value.
    expect(after.data).toBeNull()
    expect(after.data?.last_value).toBe(before.data?.last_value)
  })
})
