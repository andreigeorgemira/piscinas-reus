import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * What 0013_quote_lifecycle.sql promises: a quote can be written without
 * inventing its reference or its token, and the four statuses are reachable
 * only along the moves that mean something, each carrying its side effects.
 *
 * Every assertion here runs as a signed-in admin rather than as the service
 * role, because that is the only caller the application has: the reference
 * default calls next_reference(), which refuses anyone who is not staff.
 */
let staff: SupabaseClient
let client: SupabaseClient
let clientId: string

const YEAR = new Date().getFullYear()

/** base64url: 32 bytes is 43 characters once the '=' padding is dropped. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

async function newQuote(title: string): Promise<{ id: string; reference: string; token: string }> {
  const { data, error } = await staff
    .from('quotes')
    .insert({ client_id: clientId, title })
    .select('id, reference, access_token')
    .single()
  if (error) throw error
  return { id: data!.id, reference: data!.reference, token: data!.access_token }
}

beforeAll(async () => {
  await resetDatabase()

  const boss = await createUser(uniqueEmail('lifecycle-staff'))
  await makeAdmin(boss.id)
  staff = boss.db

  // A signed-in non-admin. Same `authenticated` role as staff, so only RLS
  // separates them -- which is the whole point of the function running with
  // invoker rights.
  const customer = await createUser(uniqueEmail('lifecycle-client'))
  client = customer.db

  const { data, error } = await adminDb()
    .from('clients')
    .insert({
      email: uniqueEmail('lifecycle'),
      full_name: 'Familia Soler',
      address: 'Camí de la Pedrera 12',
    })
    .select('id')
    .single()
  if (error) throw error
  clientId = data!.id
})

afterAll(async () => {
  await resetDatabase()
})

describe('a quote written without a reference or a token', () => {
  it('is given both', async () => {
    const quote = await newQuote('Piscina 8x4')

    expect(quote.reference).toMatch(new RegExp(`^Q-${YEAR}-\\d{4}$`))
    expect(quote.token).toMatch(TOKEN_RE)
  })

  it('never shares a token with another quote', async () => {
    // Two quotes, one assertion: a default that returned a constant would
    // pass the shape test above and fail here. The unique constraint on the
    // column would also catch a repeat, but as a 23505 on the second insert,
    // which reads as "the application tried to write a duplicate" rather
    // than "the generator is broken".
    const first = await newQuote('Primera')
    const second = await newQuote('Segunda')

    expect(first.token).not.toBe(second.token)
  })
})

describe('set_quote_status', () => {
  it('sends a draft and stamps when it left', async () => {
    const quote = await newQuote('Para enviar')

    const { error } = await staff.rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'sent',
    })
    expect(error).toBeNull()

    const { data } = await staff
      .from('quotes')
      .select('status, sent_at, responded_at')
      .eq('id', quote.id)
      .single()

    expect(data!.status).toBe('sent')
    expect(data!.sent_at).not.toBeNull()
    expect(data!.responded_at).toBeNull()
  })

  it('creates the project when the quote is accepted, and returns its reference', async () => {
    const quote = await newQuote('Piscina con gresite')
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'sent' })

    const { data: reference, error } = await staff.rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'accepted',
    })
    expect(error).toBeNull()
    expect(reference).toMatch(new RegExp(`^P-${YEAR}-\\d{4}$`))

    const { data: row } = await staff
      .from('quotes')
      .select('status, responded_at, project_id, projects(reference, name, address, status)')
      .eq('id', quote.id)
      .single()

    expect(row!.status).toBe('accepted')
    expect(row!.responded_at).not.toBeNull()
    expect(row!.project_id).not.toBeNull()
    // The project describes the job, not the paperwork: the quote's title is
    // its name and the client's address came along with it.
    expect(row!.projects).toMatchObject({
      reference,
      name: 'Piscina con gresite',
      address: 'Camí de la Pedrera 12',
      status: 'pending',
    })
  })

  it('does not create a second project when acceptance is repeated', async () => {
    const quote = await newQuote('Aceptada dos veces')
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'sent' })

    const first = await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'accepted' })
    const again = await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'accepted' })

    // Asking for the status it already holds is a no-op that still answers
    // with the project, so a double click cannot double-book the work.
    expect(again.error).toBeNull()
    expect(again.data).toBe(first.data)

    const { count } = await staff
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('name', 'Aceptada dos veces')

    expect(count).toBe(1)
  })

  it('rotates the token when a quote goes back to draft, and keeps the project', async () => {
    const quote = await newQuote('Reabierta')
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'sent' })
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'accepted' })

    const { error } = await staff.rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'draft',
    })
    expect(error).toBeNull()

    const { data } = await staff
      .from('quotes')
      .select('status, sent_at, responded_at, access_token, project_id')
      .eq('id', quote.id)
      .single()

    expect(data!.status).toBe('draft')
    expect(data!.sent_at).toBeNull()
    expect(data!.responded_at).toBeNull()
    // The link a client already holds must stop working: the figures behind
    // it are editable again from this moment.
    expect(data!.access_token).not.toBe(quote.token)
    expect(data!.access_token).toMatch(TOKEN_RE)
    // The project survives. Reopening the paperwork does not un-order the
    // materials.
    expect(data!.project_id).not.toBeNull()
  })

  it('refuses to accept a quote that was never sent', async () => {
    const quote = await newQuote('Nunca enviada')

    const { error } = await staff.rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'accepted',
    })

    expect(error?.code).toBe('P0001')
    expect(error?.message).toContain('cannot go from draft to accepted')
  })

  it('refuses a quote id that does not exist', async () => {
    const { error } = await staff.rpc('set_quote_status', {
      p_quote_id: '00000000-0000-0000-0000-000000000000',
      p_status: 'sent',
    })

    expect(error?.code).toBe('P0001')
  })
})

describe('who may move a quote', () => {
  it('refuses a signed-in client, who cannot even see the quote', async () => {
    const quote = await newQuote('Ajena')
    await staff.rpc('set_quote_status', { p_quote_id: quote.id, p_status: 'sent' })

    const { error } = await client.rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'accepted',
    })

    // Invoker rights: quotes_admin_all is the only policy on the table, so
    // the row is not there to be found. The client learns nothing about
    // whether the id was real.
    expect(error?.code).toBe('P0001')
    expect(error?.message).toContain('does not exist')

    const { data } = await staff.from('quotes').select('status').eq('id', quote.id).single()
    expect(data!.status).toBe('sent')
  })

  it('refuses an anonymous caller at the grant layer', async () => {
    const quote = await newQuote('Anónima')

    const { error } = await anonDb().rpc('set_quote_status', {
      p_quote_id: quote.id,
      p_status: 'sent',
    })

    // 42501, not an empty result: anon holds no EXECUTE on the function, so
    // Postgres refuses the call before the body runs and before RLS is
    // consulted -- the two-yeses rule 0010_table_grants.sql explains.
    expect(error?.code).toBe('42501')
  })
})
