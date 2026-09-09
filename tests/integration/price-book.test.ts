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

// Server Actions need a request context (cookies()) that vitest cannot
// provide, so this block does not call src/app/admin/price-book/actions.ts
// directly. Instead it runs the same statements those actions issue,
// through the same authenticated clients, and pins the schema/RLS behaviour
// those actions are built on: unique-name and unique-code violations
// surfacing as 23505 for describeWriteError to translate, a deleted group
// leaving its items in place, and a customer's writes being refused or
// matching nothing. It may well pass on the first run -- that is the point
// of a characterisation test, not a sign the schema is untested.
describe('price book group and item writes', () => {
  it('lets staff create a group', async () => {
    const { error } = await staff.from('price_book_groups').insert({ name: 'Vasos', position: 5 })
    expect(error).toBeNull()
  })

  it('rejects a duplicate group name with 23505', async () => {
    // 'Albanileria' already exists from the module-scope fixture.
    const { error } = await staff
      .from('price_book_groups')
      .insert({ name: 'Albanileria', position: 9 })
    expect(error?.code).toBe('23505')
  })

  it('rejects a duplicate item code with 23505', async () => {
    // 'ALB-002' already belongs to the fixture's 'Ladrillo' item.
    const { error } = await staff.from('price_book_items').insert({
      group_id: groupId,
      code: 'ALB-002',
      name: 'Duplicado',
      unit: 'unit',
      unit_cost: 1,
      unit_price: 1,
      is_active: true,
    })
    expect(error?.code).toBe('23505')
  })

  it('lets two items share a null code', async () => {
    const { error } = await staff.from('price_book_items').insert([
      {
        group_id: groupId,
        code: null,
        name: 'Sin código A',
        unit: 'unit',
        unit_cost: 1,
        unit_price: 1,
        is_active: true,
      },
      {
        group_id: groupId,
        code: null,
        name: 'Sin código B',
        unit: 'unit',
        unit_cost: 1,
        unit_price: 1,
        is_active: true,
      },
    ])
    expect(error).toBeNull()
  })

  it("moves a deleted group's items to the ungrouped bucket instead of deleting them", async () => {
    const db = adminDb()
    const { data: group } = await db
      .from('price_book_groups')
      .insert({ name: 'Temporal', position: 50 })
      .select()
      .single()
    const { data: item } = await db
      .from('price_book_items')
      .insert({
        group_id: group!.id,
        code: 'TMP-001',
        name: 'Item temporal',
        unit: 'unit',
        unit_cost: 1,
        unit_price: 1,
        is_active: true,
      })
      .select()
      .single()

    const { error } = await staff.from('price_book_groups').delete().eq('id', group!.id)
    expect(error).toBeNull()

    const { data: survivor } = await db
      .from('price_book_items')
      .select('group_id')
      .eq('id', item!.id)
      .single()
    expect(survivor?.group_id).toBeNull()
  })

  it('refuses a customer insert into price_book_groups', async () => {
    const { error } = await customer
      .from('price_book_groups')
      .insert({ name: 'Intruso', position: 1 })
    expect(error?.code).toBe('42501')
  })

  it('leaves a group untouched when a customer updates or deletes it, since RLS matches no row', async () => {
    const db = adminDb()
    const before = await db.from('price_book_groups').select('name').eq('id', groupId).single()

    // Neither call errors: RLS filters `groupId` out of the customer's view
    // before the write ever runs, so both statements affect zero rows rather
    // than being refused the way the insert above is.
    const update = await customer
      .from('price_book_groups')
      .update({ name: 'Hackeado' })
      .eq('id', groupId)
    expect(update.error).toBeNull()

    const del = await customer.from('price_book_groups').delete().eq('id', groupId)
    expect(del.error).toBeNull()

    const after = await db.from('price_book_groups').select('name').eq('id', groupId).single()
    expect(after.data?.name).toBe(before.data?.name)
  })
})

// Deleting a catalogue item is the irreversible sibling of retiring it
// (setItemActive). This proves the reason it is still safe to offer once an
// item has been copied onto a quote: quote_items.price_book_item_id is
// `on delete set null` (0001_core_schema.sql), so the line loses only the
// pointer back to the catalogue and keeps every field a client has already
// seen. The fixture sends the quote only after its line exists, because
// 0009_quote_immutability.sql freezes quote_items the moment a quote leaves
// 'draft'.
describe('deleting a price book item', () => {
  it("unlinks a sent quote's line but leaves its copied name and price untouched", async () => {
    const db = adminDb()

    const { data: client, error: clientError } = await db
      .from('clients')
      .insert({ email: uniqueEmail('provenance'), full_name: 'Cliente Provenance' })
      .select()
      .single()
    if (clientError) throw clientError

    const { data: item, error: itemError } = await db
      .from('price_book_items')
      .insert({
        code: 'PROV-001',
        name: 'Bomba de calor',
        unit: 'unit',
        unit_cost: 500,
        unit_price: 900,
        is_active: true,
      })
      .select()
      .single()
    if (itemError) throw itemError

    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9001',
        title: 'Provenance',
        access_token: 'token-provenance',
      })
      .select()
      .single()
    if (quoteError) throw quoteError

    const { data: line, error: lineError } = await db
      .from('quote_items')
      .insert({
        quote_id: quote!.id,
        price_book_item_id: item!.id,
        name: item!.name,
        unit: item!.unit,
        unit_price: item!.unit_price,
      })
      .select()
      .single()
    if (lineError) throw lineError

    const { error: sendError } = await db
      .from('quotes')
      .update({ status: 'sent' })
      .eq('id', quote!.id)
    if (sendError) throw sendError

    const { error: deleteError } = await staff.from('price_book_items').delete().eq('id', item!.id)
    expect(deleteError).toBeNull()

    const { data: survivor, error: survivorError } = await db
      .from('quote_items')
      .select('name, unit_price, price_book_item_id')
      .eq('id', line!.id)
      .single()
    if (survivorError) throw survivorError
    expect(survivor.name).toBe('Bomba de calor')
    expect(survivor.unit_price).toBe(900)
    expect(survivor.price_book_item_id).toBeNull()
  })
})
