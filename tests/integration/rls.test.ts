import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminDb,
  anonDb,
  createUser,
  makeAdmin,
  resetDatabase,
  uniqueEmail,
} from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let clientA: SupabaseClient
let clientB: SupabaseClient
let clientAId: string
let clientBId: string
let quoteAId: string
let draftAId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()

  const boss = await createUser(uniqueEmail('staff'))
  // The trigger that creates a profiles row on signup does not exist until
  // Task 9 (see tests/integration/auth-helpers.test.ts), so the row is
  // inserted here rather than assumed to exist.
  await db.from('profiles').insert({ id: boss.id })
  await makeAdmin(boss.id)
  staff = boss.db

  const a = await createUser(uniqueEmail('clienta'))
  const b = await createUser(uniqueEmail('clientb'))
  clientA = a.db
  clientB = b.db

  // Same workaround: the signup trigger that links auth.users to profiles and
  // clients does not exist until Task 9, so both rows are created directly.
  await db.from('profiles').insert({ id: a.id })
  await db
    .from('clients')
    .insert({ user_id: a.id, email: uniqueEmail('clienta-row'), full_name: 'Cliente A' })
  await db
    .from('clients')
    .insert({ user_id: b.id, email: uniqueEmail('clientb-row'), full_name: 'Cliente B' })

  const { data: rowA } = await db.from('clients').select().eq('user_id', a.id).single()
  const { data: rowB } = await db.from('clients').select().eq('user_id', b.id).single()
  clientAId = rowA!.id
  clientBId = rowB!.id

  // Built as a draft, then promoted. Task 10 adds a trigger that rejects any
  // line item written to a quote that has already been sent, so fixtures must
  // fill the quote first and change its status afterwards.
  const { data: sent } = await db
    .from('quotes')
    .insert({
      client_id: clientAId,
      reference: 'Q-2026-8001',
      title: 'Piscina de A',
      access_token: 'token-a-sent',
      internal_notes: 'margen bajo, no bajar mas',
    })
    .select()
    .single()
  quoteAId = sent!.id

  const { data: draft } = await db
    .from('quotes')
    .insert({
      client_id: clientAId,
      reference: 'Q-2026-8002',
      title: 'Borrador de A',
      status: 'draft',
      access_token: 'token-a-draft',
    })
    .select()
    .single()
  draftAId = draft!.id

  await db.from('quote_items').insert({
    quote_id: quoteAId,
    name: 'Gresite',
    unit: 'm2',
    quantity: 40,
    unit_cost: 18,
    unit_price: 32.5,
    position: 1,
  })
  await db.from('quotes').update({ status: 'sent' }).eq('id', quoteAId)

  await db.from('price_book_groups').insert({ name: 'Albanileria' })
})

afterAll(resetDatabase)

describe('clients table', () => {
  it('lets a client read only their own row', async () => {
    const { data } = await clientA.from('clients').select('id')
    expect(data).toHaveLength(1)
    expect(data![0]!.id).toBe(clientAId)
  })

  it('hides client A from client B', async () => {
    const { data } = await clientB.from('clients').select('id').eq('id', clientAId)
    expect(data).toEqual([])
  })

  it('lets an admin read every client', async () => {
    const { data } = await staff.from('clients').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(2)
  })

  it('returns nothing to an anonymous caller', async () => {
    const { data } = await anonDb().from('clients').select('id')
    expect(data).toEqual([])
  })

  it('refuses a client trying to rewrite their own email', async () => {
    const { error } = await clientA
      .from('clients')
      .update({ email: 'hijack@example.test' })
      .eq('id', clientAId)
      .select()
    const { data } = await adminDb().from('clients').select('email').eq('id', clientAId).single()
    expect(data!.email).not.toBe('hijack@example.test')
  })
})

describe('quotes table', () => {
  it('shows a sent quote to its own client', async () => {
    const { data } = await clientA.from('quotes').select('id').eq('id', quoteAId)
    expect(data).toHaveLength(1)
  })

  it('hides a draft quote from its own client', async () => {
    const { data } = await clientA.from('quotes').select('id').eq('id', draftAId)
    expect(data).toEqual([])
  })

  it('hides client A quotes from client B', async () => {
    const { data } = await clientB.from('quotes').select('id')
    expect(data).toEqual([])
  })

  it('refuses a client changing the status directly', async () => {
    await clientA.from('quotes').update({ status: 'accepted' }).eq('id', quoteAId)
    const { data } = await adminDb().from('quotes').select('status').eq('id', quoteAId).single()
    expect(data!.status).toBe('sent')
  })
})

describe('quote_items table', () => {
  it('gives a client no direct access at all', async () => {
    const { data } = await clientA.from('quote_items').select('id')
    expect(data).toEqual([])
  })

  it('lets an admin read the cost', async () => {
    const { data } = await staff.from('quote_items').select('unit_cost')
    expect(data![0]!.unit_cost).toBe(18)
  })
})

describe('price book', () => {
  it('is invisible to clients', async () => {
    const groups = await clientA.from('price_book_groups').select('id')
    const items = await clientA.from('price_book_items').select('id')
    expect(groups.data).toEqual([])
    expect(items.data).toEqual([])
  })

  it('is fully visible to admins', async () => {
    const { data } = await staff.from('price_book_groups').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('leads table', () => {
  it('accepts an anonymous submission', async () => {
    const { error } = await anonDb().from('leads').insert({
      full_name: 'Visitante',
      email: uniqueEmail('visitor'),
      message: 'Quiero presupuesto para una piscina de 8x4',
    })
    expect(error).toBeNull()
  })

  it('does not let anonymous callers read leads back', async () => {
    const { data } = await anonDb().from('leads').select('id')
    expect(data).toEqual([])
  })

  it('lets an admin read leads', async () => {
    const { data } = await staff.from('leads').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })
})

describe('profiles table', () => {
  it('lets a user read their own profile only', async () => {
    const { data } = await clientA.from('profiles').select('id')
    expect(data).toHaveLength(1)
  })

  it('refuses a client promoting themselves to admin', async () => {
    const { data: before } = await clientA.from('profiles').select('id').single()
    await clientA.from('profiles').update({ role: 'admin' }).eq('id', before!.id)
    const { data } = await adminDb().from('profiles').select('role').eq('id', before!.id).single()
    expect(data!.role).toBe('client')
  })
})
