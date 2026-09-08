import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let sentQuoteId: string
let draftQuoteId: string
let acceptedQuoteId: string
let sentItemId: string
let smuggleItemId: string
let reparentItemId: string
let acceptedItemId: string

beforeAll(async () => {
  await resetDatabase()
  const db = adminDb()
  const boss = await createUser(uniqueEmail('staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  const { data: client, error: clientError } = await db
    .from('clients')
    .insert({ email: uniqueEmail('frozen'), full_name: 'Cliente' })
    .select()
    .single()
  if (clientError) throw clientError

  const { data: sent, error: sentError } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5001',
      title: 'Enviado',
      access_token: 'token-frozen',
    })
    .select()
    .single()
  if (sentError) throw sentError
  sentQuoteId = sent!.id

  const { data: draft, error: draftError } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5002',
      title: 'Borrador',
      access_token: 'token-open',
    })
    .select()
    .single()
  if (draftError) throw draftError
  draftQuoteId = draft!.id

  const { data: accepted, error: acceptedError } = await db
    .from('quotes')
    .insert({
      client_id: client!.id,
      reference: 'Q-2026-5003',
      title: 'Aceptado',
      access_token: 'token-accepted',
    })
    .select()
    .single()
  if (acceptedError) throw acceptedError
  acceptedQuoteId = accepted!.id

  const { data: item, error: itemError } = await db
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
  if (itemError) throw itemError
  sentItemId = item!.id

  // A second recommended line on the same sent quote, dedicated to the
  // smuggled-price test below, so that test's assertions about its price
  // and client_selected value never depend on what earlier tests did to
  // sentItemId.
  const { data: smuggleItem, error: smuggleItemError } = await db
    .from('quote_items')
    .insert({
      quote_id: sentQuoteId,
      name: 'Vaso de compensacion',
      unit: 'unit',
      quantity: 1,
      unit_cost: 200,
      unit_price: 400,
      is_recommended: true,
      position: 2,
    })
    .select()
    .single()
  if (smuggleItemError) throw smuggleItemError
  smuggleItemId = smuggleItem!.id

  // A third line on the sent quote, dedicated to the reparenting test: it
  // must stay untouched by every other test so its quote_id assertion is
  // meaningful.
  const { data: reparentItem, error: reparentItemError } = await db
    .from('quote_items')
    .insert({
      quote_id: sentQuoteId,
      name: 'Depuradora',
      unit: 'unit',
      quantity: 1,
      unit_cost: 1200,
      unit_price: 2000,
      is_recommended: false,
      position: 3,
    })
    .select()
    .single()
  if (reparentItemError) throw reparentItemError
  reparentItemId = reparentItem!.id

  const { data: acceptedItem, error: acceptedItemError } = await db
    .from('quote_items')
    .insert({
      quote_id: acceptedQuoteId,
      name: 'Manta termica',
      unit: 'unit',
      quantity: 1,
      unit_cost: 300,
      unit_price: 500,
      is_recommended: true,
      position: 1,
    })
    .select()
    .single()
  if (acceptedItemError) throw acceptedItemError
  acceptedItemId = acceptedItem!.id

  // The lines exist first; only then are the quotes sent/accepted and
  // frozen. Inserting into an already-sent quote is exactly what this task
  // forbids.
  const { error: sendError } = await db
    .from('quotes')
    .update({ status: 'sent' })
    .eq('id', sentQuoteId)
  if (sendError) throw sendError

  const { error: acceptError } = await db
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', acceptedQuoteId)
  if (acceptError) throw acceptError
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
    expect(error!.code).toBe('P0001')
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
    expect(error!.code).toBe('P0001')
  })

  it('refuses deleting a line from a sent quote', async () => {
    const { error } = await staff.from('quote_items').delete().eq('id', sentItemId).select()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0001')
  })

  it('refuses a price change smuggled in together with a client_selected toggle on a sent quote', async () => {
    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 99, client_selected: true })
      .eq('id', smuggleItemId)
      .select()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0001')

    const { data: unchanged, error: readError } = await adminDb()
      .from('quote_items')
      .select('unit_price, client_selected')
      .eq('id', smuggleItemId)
      .single()
    if (readError) throw readError
    expect(unchanged!.unit_price).toBe(400)
    expect(unchanged!.client_selected).toBe(false)
  })

  it('refuses moving a line item out of a sent quote into a draft quote', async () => {
    const { error } = await staff
      .from('quote_items')
      .update({ quote_id: draftQuoteId })
      .eq('id', reparentItemId)
      .select()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0001')

    const { data: unchanged, error: readError } = await adminDb()
      .from('quote_items')
      .select('quote_id')
      .eq('id', reparentItemId)
      .single()
    if (readError) throw readError
    expect(unchanged!.quote_id).toBe(sentQuoteId)
  })

  it('refuses toggling client_selected on an accepted quote', async () => {
    const { error } = await staff
      .from('quote_items')
      .update({ client_selected: true })
      .eq('id', acceptedItemId)
      .select()
    expect(error).not.toBeNull()
    expect(error!.code).toBe('P0001')
  })

  it('still allows toggling the client extras selection', async () => {
    const { error } = await staff
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
    const { error: reopenError } = await adminDb()
      .from('quotes')
      .update({ status: 'draft' })
      .eq('id', sentQuoteId)
    if (reopenError) throw reopenError

    const { error } = await staff
      .from('quote_items')
      .update({ unit_price: 30 })
      .eq('id', sentItemId)
      .select()
    expect(error).toBeNull()

    const { error: resendError } = await adminDb()
      .from('quotes')
      .update({ status: 'sent' })
      .eq('id', sentQuoteId)
    if (resendError) throw resendError
  })
})
