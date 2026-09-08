import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let sentQuoteId: string
let draftQuoteId: string
let sentItemId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()
  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const { data: client } = await db
    .from('clients')
    .insert({ email: uniqueEmail('frozen'), full_name: 'Cliente' })
    .select()
    .single()

  const { data: sent } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5001',
      title: 'Enviado',
      access_token: 'token-frozen',
    })
    .select()
    .single()
  sentQuoteId = sent!.id

  const { data: draft } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5002',
      title: 'Borrador',
      access_token: 'token-open',
    })
    .select()
    .single()
  draftQuoteId = draft!.id

  const { data: item } = await db
    .from('quote_items')
    .insert({
      quote_id: sentQuoteId,
      name: 'Gresite',
      unit: 'm2',
      quantity: 40,
      unit_cost: 18,
      unit_price: 32.5,
      is_recommended: true,
      position: 1,
    })
    .select()
    .single()
  sentItemId = item!.id

  // The line exists first; only then is the quote sent and frozen. Inserting
  // into an already-sent quote is exactly what this task forbids.
  await db.from('quotes').update({ status: 'sent' }).eq('id', sentQuoteId)
})

afterAll(resetDatabase)

describe('sent quote immutability', () => {
  it('refuses a price change on a sent quote', async () => {
    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 99 })
      .eq('id', sentItemId)
      .select()
    expect(error).not.toBeNull()
  })

  it('refuses a new line on a sent quote', async () => {
    const { error } = await staff.from('quote_items').insert({
      quote_id: sentQuoteId,
      name: 'Extra colado',
      unit: 'unit',
      quantity: 1,
      unit_price: 10,
      position: 9,
    })
    expect(error).not.toBeNull()
  })

  it('refuses deleting a line from a sent quote', async () => {
    const { error } = await staff.from('quote_items').delete().eq('id', sentItemId).select()
    expect(error).not.toBeNull()
  })

  it('still allows toggling the client extras selection', async () => {
    const { error } = await adminDb()
      .from('quote_items')
      .update({ client_selected: true })
      .eq('id', sentItemId)
    expect(error).toBeNull()
  })

  it('allows every edit while the quote is a draft', async () => {
    const { error } = await staff.from('quote_items').insert({
      quote_id: draftQuoteId,
      name: 'Linea libre',
      unit: 'hour',
      quantity: 8,
      unit_price: 35,
      position: 1,
    })
    expect(error).toBeNull()
  })

  it('allows editing again after the quote returns to draft', async () => {
    await adminDb().from('quotes').update({ status: 'draft' }).eq('id', sentQuoteId)
    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 30 })
      .eq('id', sentItemId)
      .select()
    expect(error).toBeNull()
    await adminDb().from('quotes').update({ status: 'sent' }).eq('id', sentQuoteId)
  })
})
