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

  // The account-linking trigger (migration 0008) creates the profiles and
  // clients rows automatically once each account's email is confirmed.
  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const a = await createUser(uniqueEmail('clienta'))
  const b = await createUser(uniqueEmail('clientb'))
  clientA = a.db
  clientB = b.db

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
  it('gives a client no direct access to their own row', async () => {
    const { data } = await clientA.from('clients').select('id').eq('id', clientAId)
    expect(data).toEqual([])
  })

  it('hides client A from client B', async () => {
    const { data } = await clientB.from('clients').select('id').eq('id', clientAId)
    expect(data).toEqual([])
  })

  it('lets an admin read every client', async () => {
    const { data } = await staff.from('clients').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(2)
  })

  it('refuses an anonymous caller at the grant layer', async () => {
    // Before 0010_table_grants.sql, anon held SELECT on every base table
    // via Supabase's default privileges, and this assertion (`[]`)
    // documented RLS refusing the row rather than the grant refusing the
    // statement. The grant is gone now, so the request is refused before
    // RLS is ever consulted - see tests/integration/grants.test.ts for the
    // full sweep across all nine base tables.
    const { data, error } = await anonDb().from('clients').select('id')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
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

  it('does not let a client select the notes column directly', async () => {
    const { data } = await clientA.from('clients').select('notes').eq('id', clientAId)
    expect(data).toEqual([])
  })

  it('lets an admin read the notes column', async () => {
    const { data } = await adminDb().from('clients').select('notes').eq('id', clientAId).single()
    expect(data).not.toBeNull()
  })
})

describe('quotes table', () => {
  it('gives a client no direct access to a sent quote', async () => {
    const { data } = await clientA.from('quotes').select('id').eq('id', quoteAId)
    expect(data).toEqual([])
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

  it('does not let a client select internal_notes directly', async () => {
    const { data } = await clientA.from('quotes').select('internal_notes').eq('id', quoteAId)
    expect(data).toEqual([])
  })

  it('lets an admin read internal_notes from the base table', async () => {
    const { data } = await staff
      .from('quotes')
      .select('internal_notes')
      .eq('id', quoteAId)
      .single()
    expect(data!.internal_notes).toBe('margen bajo, no bajar mas')
  })
})

describe('projects table', () => {
  it('does not let a client select the notes column directly', async () => {
    const { data } = await clientA.from('projects').select('notes')
    expect(data).toEqual([])
  })
})

describe('client_quotes view', () => {
  it('shows a client their own sent quote without internal_notes', async () => {
    const { data } = await clientA.from('client_quotes').select('*').eq('id', quoteAId)
    expect(data).toHaveLength(1)
    expect(data![0]).not.toHaveProperty('internal_notes')
  })

  it('does not show a client their own draft quote', async () => {
    const { data } = await clientA.from('client_quotes').select('id').eq('id', draftAId)
    expect(data).toEqual([])
  })

  it('hides client A quotes from client B', async () => {
    const { data } = await clientB.from('client_quotes').select('id')
    expect(data).toEqual([])
  })
})

describe('client_profile view', () => {
  it('shows a client their own profile without notes', async () => {
    const { data } = await clientA.from('client_profile').select('*').eq('id', clientAId)
    expect(data).toHaveLength(1)
    expect(data![0]).not.toHaveProperty('notes')
  })

  it('hides client A from client B', async () => {
    const { data } = await clientB.from('client_profile').select('id').eq('id', clientAId)
    expect(data).toEqual([])
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
    // Before 0010_table_grants.sql this was RLS refusing a request anon
    // still had SELECT privilege to make (`[]`). anon now holds INSERT
    // only on leads, so the request is refused at the grant layer instead,
    // before RLS is consulted - which also means `.insert(...).select()`
    // can never be used to read back the row a request just wrote.
    const { data, error } = await anonDb().from('leads').select('id')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('lets an admin read leads', async () => {
    const { data } = await staff.from('leads').select('id')
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects an anonymous submission that sets status directly', async () => {
    const { error } = await anonDb().from('leads').insert({
      full_name: 'Visitante',
      email: uniqueEmail('visitor-discarded'),
      message: 'Intento de saltarse la triage',
      status: 'discarded',
    })
    expect(error).not.toBeNull()
  })

  it('rejects an anonymous submission that attributes itself to a client', async () => {
    const { error } = await anonDb().from('leads').insert({
      full_name: 'Visitante',
      email: uniqueEmail('visitor-attributed'),
      message: 'Intento de vincularse a un cliente existente',
      client_id: clientAId,
    })
    expect(error).not.toBeNull()
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
