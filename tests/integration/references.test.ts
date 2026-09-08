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

  it('is not callable by an anonymous visitor', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { LOCAL_URL, LOCAL_ANON_KEY } = await import('./helpers/db')
    const anon = createClient(LOCAL_URL, LOCAL_ANON_KEY)
    const { error } = await anon.rpc('next_reference', { p_prefix: 'Q' })
    expect(error).not.toBeNull()
  })
})
