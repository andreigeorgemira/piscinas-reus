import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, resetDatabase, uniqueEmail } from './helpers/db'

// Postgres needs two independent yeses before a row is touched: a table
// privilege and, when RLS is on, a policy (0010_table_grants.sql explains
// why in full). This file probes the privilege layer directly, so every
// assertion here must be error code 42501 - not an empty array. `[]` means
// RLS answered the question; 42501 means Postgres refused to let the
// question be asked at all. Mixing the two up is exactly the bug this
// migration fixes: before it, anon could SELECT every table below and was
// stopped only by RLS.
const BASE_TABLES = [
  'profiles',
  'clients',
  'projects',
  'quotes',
  'quote_items',
  'price_book_groups',
  'price_book_items',
  'leads',
  'reference_counters',
] as const

beforeAll(resetDatabase)
afterAll(resetDatabase)

describe('anonymous select is refused at the grant layer', () => {
  for (const table of BASE_TABLES) {
    it(`refuses select on ${table}`, async () => {
      // select('*'), not a named column: reference_counters has no `id`
      // column, and the point of this test is the grant check, not the
      // column list.
      const { data, error } = await anonDb().from(table).select('*')
      expect(data).toBeNull()
      expect(error?.code).toBe('42501')
    })
  }
})

describe('anonymous insert is refused everywhere except leads', () => {
  for (const table of BASE_TABLES.filter((t) => t !== 'leads')) {
    it(`refuses insert on ${table}`, async () => {
      // The payload is empty on purpose. A privilege check runs before any
      // row is evaluated, so this must fail with 42501 regardless of which
      // not-null columns the table declares - if it ever fails with a
      // constraint error instead (23502 and friends), that is a sign the
      // grant let the statement through and only a later check stopped it.
      const { error } = await anonDb().from(table).insert({})
      expect(error?.code).toBe('42501')
    })
  }
})

describe('leads: the one anonymous write in the system', () => {
  it('accepts an anonymous insert', async () => {
    const { error } = await anonDb()
      .from('leads')
      .insert({
        full_name: 'Visitante',
        email: uniqueEmail('visitor'),
        message: 'Quiero presupuesto para una piscina de 8x4',
      })
    expect(error).toBeNull()
  })

  it('still refuses reading a lead back', async () => {
    // anon has INSERT only, so `.insert(...).select()` cannot be used to
    // read the row the request just wrote either - it hits this same wall.
    const { data, error } = await anonDb().from('leads').select('*')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })
})

describe('service_role', () => {
  it('can write price_book_groups', async () => {
    const { data, error } = await adminDb()
      .from('price_book_groups')
      .insert({ name: uniqueEmail('group') })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data?.name).toBeTruthy()
  })
})
