import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listPriceBook, UNGROUPED_NAME } from '@/lib/price-book/queries'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

// Left in module scope, not local to beforeAll, because later tasks in this
// phase append describe blocks to this same file and reuse these fixtures
// rather than paying for a second admin/customer/group setup.
let staff: SupabaseClient
let customer: SupabaseClient
let groupId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()

  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const buyer = await createUser(uniqueEmail('customer'))
  customer = buyer.db

  // Inserted out of position order, so a passing test proves the query
  // sorts rather than merely echoing insertion order.
  const { data: revestimientos } = await db
    .from('price_book_groups')
    .insert({ name: 'Revestimientos', position: 2 })
    .select()
    .single()

  const { data: albanileria } = await db
    .from('price_book_groups')
    .insert({ name: 'Albanileria', position: 1 })
    .select()
    .single()
  groupId = albanileria!.id

  // A bulk insert must give every row the same set of keys: PostgREST takes
  // its column list from the batch, and a row that omits one silently gets
  // null (then trips the not-null constraint) instead of the column
  // default. `is_active` is spelled out on every row for that reason.
  await db.from('price_book_items').insert([
    {
      group_id: groupId,
      code: 'ALB-002',
      name: 'Ladrillo',
      unit: 'unit',
      unit_cost: 1.2,
      unit_price: 2.5,
      is_active: true,
    },
    {
      // Retired, but still expected back: this screen exists to bring
      // retired items back, hiding them is the quote editor's job.
      group_id: groupId,
      code: 'ALB-001',
      name: 'Cemento',
      unit: 'kg',
      unit_cost: 0.5,
      unit_price: 1.1,
      is_active: false,
    },
    {
      group_id: revestimientos!.id,
      code: null,
      name: 'Gresite',
      unit: 'm2',
      unit_cost: 4,
      unit_price: 9.9,
      is_active: true,
    },
    {
      group_id: null,
      code: null,
      name: 'Suelto',
      unit: 'unit',
      unit_cost: 3,
      unit_price: 5,
      is_active: true,
    },
  ])
})

afterAll(resetDatabase)

describe('listPriceBook', () => {
  it('orders groups by position with the ungrouped bucket last', async () => {
    const groups = await listPriceBook(staff)
    expect(groups.map((g) => g.name)).toEqual([
      'Albanileria',
      'Revestimientos',
      UNGROUPED_NAME,
    ])
  })

  it('nests items under their group, ordered by code', async () => {
    const groups = await listPriceBook(staff)
    const albanileria = groups.find((g) => g.name === 'Albanileria')!
    expect(albanileria.items.map((i) => i.code)).toEqual(['ALB-001', 'ALB-002'])
  })

  it('serialises prices as numbers, not strings', async () => {
    const groups = await listPriceBook(staff)
    const item = groups.flatMap((g) => g.items)[0]!
    expect(typeof item.unitCost).toBe('number')
    expect(typeof item.unitPrice).toBe('number')
  })

  it('still returns a retired item', async () => {
    const groups = await listPriceBook(staff)
    const albanileria = groups.find((g) => g.name === 'Albanileria')!
    const retired = albanileria.items.find((i) => i.code === 'ALB-001')
    expect(retired?.isActive).toBe(false)
  })

  it('gives the synthetic ungrouped bucket a null id', async () => {
    const groups = await listPriceBook(staff)
    const ungrouped = groups.find((g) => g.name === UNGROUPED_NAME)!
    expect(ungrouped.id).toBeNull()
    expect(ungrouped.items.map((i) => i.name)).toEqual(['Suelto'])
  })

  it('returns nothing for a customer, since RLS matches no rows', async () => {
    const groups = await listPriceBook(customer)
    expect(groups).toEqual([])
  })
})

describe('listPriceBook ungrouped bucket', () => {
  it('is omitted entirely when nothing is ungrouped', async () => {
    // The shared fixture above always has one ungrouped item ('Suelto'), so
    // every assertion so far only ever exercises the guard's true branch -
    // deleting `if (ungroupedItems.length > 0)` in queries.ts would not
    // fail a single test without this one. Reassigning the ungrouped rows
    // into the known fixture group (rather than resetting the database)
    // proves the false branch without disturbing `staff`, `customer` or
    // `groupId`, which later blocks in this file depend on.
    const db = adminDb()
    const { data: ungroupedRows } = await db
      .from('price_book_items')
      .select('id')
      .is('group_id', null)

    await db.from('price_book_items').update({ group_id: groupId }).is('group_id', null)

    try {
      const groups = await listPriceBook(staff)
      expect(groups.map((g) => g.name)).not.toContain(UNGROUPED_NAME)
    } finally {
      for (const row of ungroupedRows ?? []) {
        await db.from('price_book_items').update({ group_id: null }).eq('id', row.id)
      }
    }
  })
})
