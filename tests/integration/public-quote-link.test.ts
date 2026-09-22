import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * What 0015_public_quote_link.sql promises: a token is a door to one document
 * and nothing else.
 *
 * Every assertion that matters here runs as `anon` -- no session, no cookie,
 * nothing but the token -- because that is the only caller the public page ever
 * has. The admin client is used to arrange fixtures and to read back what the
 * anonymous caller managed to change.
 */
let staff: SupabaseClient
let visitor: SupabaseClient
let clientId: string

type Quote = { id: string; token: string }

async function newQuote(title: string, withClient = true): Promise<Quote> {
  const { data, error } = await staff
    .from('quotes')
    .insert({ client_id: withClient ? clientId : null, title })
    .select('id, access_token')
    .single()
  if (error) throw error
  return { id: data!.id, token: data!.access_token }
}

async function addLine(
  quoteId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await staff
    .from('quote_items')
    .insert({
      quote_id: quoteId,
      name: 'Gresite 2,5x2,5',
      unit: 'm2',
      quantity: 10,
      unit_cost: 18,
      unit_price: 32.5,
      group_name: 'Revestimiento',
      ...overrides,
    })
    .select('id')
    .single()
  if (error) throw error
  return data!.id
}

async function send(quoteId: string): Promise<void> {
  const { error } = await staff.rpc('set_quote_status', {
    p_quote_id: quoteId,
    p_status: 'sent',
  })
  if (error) throw error
}

beforeAll(async () => {
  await resetDatabase()

  const boss = await createUser(uniqueEmail('link-staff'))
  await makeAdmin(boss.id)
  staff = boss.db
  visitor = anonDb()

  const { data, error } = await adminDb()
    .from('clients')
    .insert({
      email: uniqueEmail('link-client'),
      full_name: 'Familia Soler',
      address: 'Camí de la Pedrera 12',
      city: 'Reus',
    })
    .select('id')
    .single()
  if (error) throw error
  clientId = data!.id
})

afterAll(async () => {
  await resetDatabase()
})

describe('reading a quote with its token', () => {
  it('says nothing at all while the quote is a draft', async () => {
    const quote = await newQuote('Todavía en borrador')
    await addLine(quote.id)

    const { data, error } = await visitor.rpc('quote_by_token', { p_token: quote.token })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('answers the same nothing for a token that does not exist', async () => {
    // A caller must not be able to tell a wrong token from one that is not
    // ready: both are null.
    const { data } = await visitor.rpc('quote_by_token', { p_token: 'no-es-un-token' })

    expect(data).toBeNull()
  })

  it('hands over the document once it is sent', async () => {
    const quote = await newQuote('Piscina 8x4 con gresite')
    await addLine(quote.id)
    await send(quote.id)

    const { data, error } = await visitor.rpc('quote_by_token', { p_token: quote.token })

    expect(error).toBeNull()
    expect(data).toMatchObject({
      reference: expect.stringMatching(/^Q-\d{4}-\d{4}$/),
      title: 'Piscina 8x4 con gresite',
      status: 'sent',
      client: { full_name: 'Familia Soler', city: 'Reus' },
    })
    expect(data.items).toHaveLength(1)
    // 10 × 32,50
    expect(Number(data.totals.base_total)).toBe(325)
    expect(Number(data.totals.grand_total)).toBe(325)
  })

  it('never carries the cost, the margin or the internal notes', async () => {
    const quote = await newQuote('Con notas internas')
    await staff
      .from('quotes')
      .update({ internal_notes: 'Margen justo, no bajar del 20%' })
      .eq('id', quote.id)
    await addLine(quote.id)
    await send(quote.id)

    const { data } = await visitor.rpc('quote_by_token', { p_token: quote.token })

    const asText = JSON.stringify(data)
    expect(asText).not.toContain('unit_cost')
    expect(asText).not.toContain('internal_notes')
    expect(asText).not.toContain('Margen justo')
    expect(asText).not.toContain('margin')
  })

  it('stops working when the quote goes back to draft', async () => {
    // Reopening mints a new token (0013_quote_lifecycle.sql), which is what makes
    // a link somebody forwarded stop resolving once the figures can change again.
    const quote = await newQuote('Reabierta tras enviarla')
    await addLine(quote.id)
    await send(quote.id)
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'draft' })

    const { data } = await visitor.rpc('quote_by_token', { p_token: quote.token })

    expect(data).toBeNull()
  })

  it('does not open the tables themselves', async () => {
    const quote = await newQuote('La puerta es la función')
    await send(quote.id)

    // The token is a credential for ONE function, not a way into the schema:
    // anon holds no privilege on the tables at all (0010_table_grants.sql).
    const direct = await visitor.from('quotes').select('id').eq('access_token', quote.token)
    expect(direct.error?.code).toBe('42501')
  })
})

describe('ticking an optional extra from the link', () => {
  it('marks a recommended line and moves the total', async () => {
    const quote = await newQuote('Con extras')
    await addLine(quote.id)
    const extra = await addLine(quote.id, {
      name: 'Clorador salino',
      unit: 'unit',
      quantity: 1,
      unit_price: 980,
      unit_cost: 620,
      is_recommended: true,
    })
    await send(quote.id)

    const { data: ok } = await visitor.rpc('set_quote_extra_by_token', {
      p_token: quote.token,
      p_item_id: extra,
      p_selected: true,
    })
    expect(ok).toBe(true)

    const { data } = await visitor.rpc('quote_by_token', { p_token: quote.token })
    expect(Number(data.totals.selected_extras_total)).toBe(980)
    expect(Number(data.totals.grand_total)).toBe(325 + 980)
  })

  it('refuses a line that is not an optional extra', async () => {
    const quote = await newQuote('Sin extras que marcar')
    const base = await addLine(quote.id)
    await send(quote.id)

    const { data } = await visitor.rpc('set_quote_extra_by_token', {
      p_token: quote.token,
      p_item_id: base,
      p_selected: true,
    })

    expect(data).toBe(false)
  })

  it('refuses once the quote has been answered', async () => {
    const quote = await newQuote('Ya respondida')
    const extra = await addLine(quote.id, { is_recommended: true })
    await send(quote.id)
    await visitor.rpc('reject_quote_by_token', { p_token: quote.token })

    const { data } = await visitor.rpc('set_quote_extra_by_token', {
      p_token: quote.token,
      p_item_id: extra,
      p_selected: true,
    })

    expect(data).toBe(false)
  })
})

describe('signing from the link', () => {
  it('records who signed, when, and creates the project', async () => {
    const quote = await newQuote('Para firmar')
    await addLine(quote.id)
    await send(quote.id)

    const { data: reference, error } = await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: '  Marta Soler  ',
      p_signature: 'data:image/png;base64,iVBORw0KGgo=',
      p_user_agent: 'Mozilla/5.0 (prueba)',
    })

    expect(error).toBeNull()
    expect(reference).toMatch(/^P-\d{4}-\d{4}$/)

    const { data } = await staff
      .from('quotes')
      .select('status, signed_name, signed_at, signature_image, signed_user_agent, project_id')
      .eq('id', quote.id)
      .single()

    expect(data!.status).toBe('accepted')
    // Trimmed, because a name typed on a phone arrives with a space on it.
    expect(data!.signed_name).toBe('Marta Soler')
    expect(data!.signed_at).not.toBeNull()
    expect(data!.signature_image).toContain('data:image/png')
    expect(data!.signed_user_agent).toContain('prueba')
    expect(data!.project_id).not.toBeNull()
  })

  it('refuses a signature with no name', async () => {
    const quote = await newQuote('Sin nombre')
    await send(quote.id)

    const { error } = await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: '   ',
    })

    expect(error?.code).toBe('P0001')
    expect(error?.message).toContain('needs a name')
  })

  it('refuses a quote with no client, because a project belongs to somebody', async () => {
    const quote = await newQuote('Sin cliente', false)
    await send(quote.id)

    const { error } = await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: 'Quien sea',
    })

    expect(error?.code).toBe('P0001')
    expect(error?.message).toContain('has no client')
  })

  it('cannot be signed twice', async () => {
    const quote = await newQuote('Firmada una vez')
    await addLine(quote.id)
    await send(quote.id)
    await visitor.rpc('accept_quote_by_token', { p_token: quote.token, p_name: 'Marta' })

    const { error } = await visitor.rpc('accept_quote_by_token', {
      p_token: quote.token,
      p_name: 'Otra persona',
    })

    expect(error?.code).toBe('P0001')
    expect(error?.message).toContain('not open for signing')
  })
})

describe('rejecting from the link', () => {
  it('records the answer and the reason', async () => {
    const quote = await newQuote('Para rechazar')
    await addLine(quote.id)
    await send(quote.id)

    const { data: ok } = await visitor.rpc('reject_quote_by_token', {
      p_token: quote.token,
      p_reason: 'Nos hemos decidido por otra empresa.',
    })
    expect(ok).toBe(true)

    const { data } = await staff
      .from('quotes')
      .select('status, responded_at, rejection_reason')
      .eq('id', quote.id)
      .single()

    expect(data!.status).toBe('rejected')
    expect(data!.responded_at).not.toBeNull()
    expect(data!.rejection_reason).toBe('Nos hemos decidido por otra empresa.')
  })

  it('answers false for a token that is not open', async () => {
    const quote = await newQuote('Todavía borrador')

    const { data } = await visitor.rpc('reject_quote_by_token', { p_token: quote.token })

    expect(data).toBe(false)
  })
})
