import { beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'

/**
 * What 0016_reopen_forgets_the_answer.sql promises: a quote that goes back to
 * draft is a new version of the document, and a new version starts unanswered.
 *
 * The failure this pins down was seen in the browser: a quote accepted at one
 * price, reopened, repriced and sent again printed "Presupuesto aceptado,
 * firmado por ..." under figures nobody had signed.
 */
let staff: SupabaseClient
let visitor: SupabaseClient
let clientId: string

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function sentQuote(title: string): Promise<{ id: string; token: string; extraId: string }> {
  const { data, error } = await staff
    .from('quotes')
    .insert({ client_id: clientId, title })
    .select('id')
    .single()
  if (error) throw error

  const lines = await staff
    .from('quote_items')
    .insert([
      { quote_id: data!.id, name: 'Gresite', unit: 'm2', quantity: 10, unit_price: 30, unit_cost: 18, is_recommended: false, group_name: 'Revestimiento' },
      { quote_id: data!.id, name: 'Foco LED', unit: 'unit', quantity: 2, unit_price: 150, unit_cost: 60, is_recommended: true, group_name: 'Iluminación' },
    ])
    .select('id, is_recommended')
  if (lines.error) throw lines.error

  const moved = await staff.rpc('set_quote_status', { p_quote_id: data!.id, p_status: 'sent' })
  if (moved.error) throw moved.error

  const { data: row, error: readError } = await staff
    .from('quotes')
    .select('access_token')
    .eq('id', data!.id)
    .single()
  if (readError) throw readError

  const extra = (lines.data as { id: string; is_recommended: boolean }[]).find((l) => l.is_recommended)!
  return { id: data!.id, token: row!.access_token, extraId: extra.id }
}

async function reopen(id: string): Promise<void> {
  const { error } = await staff.rpc('set_quote_status', { p_quote_id: id, p_status: 'draft' })
  if (error) throw error
}

beforeAll(async () => {
  await resetDatabase()
  const boss = await createUser(uniqueEmail('reopen-staff'))
  await makeAdmin(boss.id)
  staff = boss.db
  visitor = anonDb()

  const { data, error } = await adminDb()
    .from('clients')
    .insert({ email: uniqueEmail('reopen-client'), full_name: 'Familia Ribas' })
    .select('id')
    .single()
  if (error) throw error
  clientId = data!.id
})

describe('reopening a quote', () => {
  it('forgets the signature and the ticked extras of an accepted quote', async () => {
    const quote = await sentQuote('Aceptado y reabierto')

    const tick = await visitor.rpc('set_quote_extra_by_token', {
      p_token: quote.token,
      p_item_id: quote.extraId,
      p_selected: true,
    })
    expect(tick.data).toBe(true)

    const signed = await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: 'Marta Ribas',
      p_signature: PNG,
      p_user_agent: 'test',
    })
    expect(signed.error).toBeNull()

    await reopen(quote.id)

    const { data } = await staff
      .from('quotes')
      .select('status, signed_name, signed_at, signed_user_agent, signature_image, project_id')
      .eq('id', quote.id)
      .single()
    expect(data).toMatchObject({
      status: 'draft',
      signed_name: null,
      signed_at: null,
      signed_user_agent: null,
      signature_image: null,
    })
    // The work the acceptance created is not undone by reopening the paperwork.
    expect(data!.project_id).not.toBeNull()

    const { data: extra } = await staff
      .from('quote_items')
      .select('client_selected')
      .eq('id', quote.extraId)
      .single()
    expect(extra!.client_selected).toBe(false)
  })

  it('forgets the reason a quote was refused', async () => {
    const quote = await sentQuote('Rechazado y reabierto')

    const refused = await visitor.rpc('reject_quote_by_token', {
      p_token: quote.token,
      p_reason: 'Demasiado caro',
    })
    expect(refused.data).toBe(true)

    await reopen(quote.id)

    const { data } = await staff
      .from('quotes')
      .select('rejection_reason')
      .eq('id', quote.id)
      .single()
    expect(data!.rejection_reason).toBeNull()
  })

  it('sends the new version out unanswered', async () => {
    const quote = await sentQuote('Firmado, reabierto y reenviado')
    await visitor.rpc('accept_quote_by_token', { p_token: quote.token, p_name: 'Marta Ribas' })
    await reopen(quote.id)

    const resent = await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'sent' })
    expect(resent.error).toBeNull()

    const { data: row } = await staff.from('quotes').select('access_token').eq('id', quote.id).single()
    const { data: page } = await visitor.rpc('quote_by_token', { p_token: row!.access_token })
    expect(page).toMatchObject({ status: 'sent', signed_name: null, signed_at: null })
  })
})

describe('the drawn signature behind a token', () => {
  it('is given only for an accepted quote', async () => {
    const quote = await sentQuote('Firma por enlace')

    const before = await visitor.rpc('quote_signature_by_token', { p_token: quote.token })
    expect(before.data).toBeNull()

    await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: 'Marta Ribas',
      p_signature: PNG,
    })

    const after = await visitor.rpc('quote_signature_by_token', { p_token: quote.token })
    expect(after.data).toBe(PNG)
  })

  it('answers nothing for a token that is not a quote', async () => {
    const { data, error } = await visitor.rpc('quote_signature_by_token', {
      p_token: 'no-such-token-anywhere-at-all',
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
