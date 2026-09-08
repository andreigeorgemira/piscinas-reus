import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient

beforeAll(async () => {
  await resetDatabase()
  await adminDb().from('reference_counters').delete().gte('year', 0)
  // The account-linking trigger (migration 0008) creates the profiles row
  // automatically once the email is confirmed.
  const boss = await createUser(uniqueEmail('staff'))
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

  it('rejects an anonymous caller at the grant layer', async () => {
    // 0007_function_grants.sql closes the gap described in
    // task-8-report.md ("Fix round 1"/"Fix round 2"): Supabase's default
    // privileges grant EXECUTE on every public-schema function directly to
    // anon/authenticated/service_role at creation time, so the earlier
    // `revoke all ... from public` in 0006_references.sql never actually
    // removed anon's EXECUTE grant on next_reference - it only removed the
    // (here, nonexistent) PUBLIC grant. Before 0007, this anonymous call
    // was refused by the is_admin() check inside next_reference, same as
    // any other non-admin; now it never reaches the function body at all.
    //
    // Probed directly against PostgREST rather than assumed: after 0007,
    // an anonymous RPC call gets Postgres's own "permission denied for
    // function" error (still SQLSTATE 42501, but a different message than
    // the is_admin() check raises), which is what pins this down as a
    // grant-layer rejection rather than the runtime check.
    const year = new Date().getFullYear()

    const before = await adminDb()
      .from('reference_counters')
      .select('last_value')
      .eq('prefix', 'ANONGRANT')
      .eq('year', year)
      .maybeSingle()

    const { data, error } = await anonDb().rpc('next_reference', { p_prefix: 'ANONGRANT' })

    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
    expect(error?.message).toBe('permission denied for function next_reference')

    const after = await adminDb()
      .from('reference_counters')
      .select('last_value')
      .eq('prefix', 'ANONGRANT')
      .eq('year', year)
      .maybeSingle()

    // Never got far enough to touch the counter.
    expect(after.data).toBeNull()
    expect(after.data?.last_value).toBe(before.data?.last_value)
  })

  it('rejects a signed-in non-admin without advancing the counter', async () => {
    const year = new Date().getFullYear()
    // The account-linking trigger creates the profiles row automatically
    // (see the beforeAll comment). No makeAdmin() call here - this user
    // must stay a non-admin.
    const customer = await createUser(uniqueEmail('customer'))

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
