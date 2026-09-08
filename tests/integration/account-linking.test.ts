import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, resetDatabase, uniqueEmail } from './helpers/db'

beforeAll(resetDatabase)
afterAll(resetDatabase)

describe('account linking', () => {
  it('creates a profile with the client role', async () => {
    const { id } = await createUser(uniqueEmail('newcomer'))
    const { data } = await adminDb().from('profiles').select().eq('id', id).single()
    expect(data!.role).toBe('client')
  })

  it('lets current_client_id resolve the linked record', async () => {
    const { id, db } = await createUser(uniqueEmail('resolver'))
    const { data: client } = await adminDb()
      .from('clients')
      .select()
      .eq('user_id', id)
      .single()

    const { data } = await db.rpc('current_client_id')
    expect(data).toBe(client!.id)
  })

  it('creates a client row for a brand new registration', async () => {
    const email = uniqueEmail('fresh')
    const { id } = await createUser(email)
    const { data } = await adminDb().from('clients').select().eq('user_id', id).single()
    expect(data!.email.toLowerCase()).toBe(email.toLowerCase())
  })

  it('adopts a client record that staff created earlier', async () => {
    const email = uniqueEmail('quoted-first')
    const { data: existing } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Presupuestado antes' })
      .select()
      .single()
    expect(existing!.user_id).toBeNull()

    const { id } = await createUser(email)

    const { data: linked } = await adminDb()
      .from('clients')
      .select()
      .eq('id', existing!.id)
      .single()
    expect(linked!.user_id).toBe(id)
    expect(linked!.full_name).toBe('Presupuestado antes')
  })

  it('matches the existing record regardless of letter case', async () => {
    const email = uniqueEmail('MixedCase')
    await adminDb().from('clients').insert({ email: email.toUpperCase(), full_name: 'Mixta' })
    const { id } = await createUser(email.toLowerCase())
    const { data } = await adminDb().from('clients').select().eq('user_id', id)
    expect(data).toHaveLength(1)
  })

  it('leaves quotes written before registration attached to the adopted record', async () => {
    const email = uniqueEmail('history')
    const { data: client } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Con historial' })
      .select()
      .single()
    await adminDb().from('quotes').insert({
      client_id: client!.id,
      reference: 'Q-2026-6001',
      title: 'Presupuesto anterior al registro',
      status: 'sent',
      access_token: 'token-history',
    })

    const { db } = await createUser(email)
    // migration 0004 dropped quotes_select_own and moved customer reads to
    // the client_quotes view (see that migration's header comment): a
    // customer session has no policy on the base `quotes` table at all.
    const { data: visible } = await db.from('client_quotes').select('reference')

    expect(visible).toHaveLength(1)
    expect(visible![0]!.reference).toBe('Q-2026-6001')
  })

  it('does not link an unconfirmed account', async () => {
    const email = uniqueEmail('unconfirmed')
    const { data, error } = await adminDb().auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: false,
    })
    expect(error).toBeNull()

    const { data: rows } = await adminDb().from('clients').select().eq('user_id', data!.user!.id)
    expect(rows).toEqual([])
  })

  it('does not steal a client already linked to somebody else', async () => {
    const email = uniqueEmail('taken')
    const first = await createUser(email)
    const { data: before } = await adminDb().from('clients').select().eq('user_id', first.id).single()

    // A second account cannot exist for the same email in Supabase auth, so
    // assert instead that the link is stable and singular.
    const { data: all } = await adminDb().from('clients').select().eq('email', email)
    expect(all).toHaveLength(1)
    expect(all![0]!.id).toBe(before!.id)
  })
})
