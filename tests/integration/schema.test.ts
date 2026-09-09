import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, resetDatabase, uniqueEmail } from './helpers/db'

describe('core schema', () => {
  beforeAll(resetDatabase)
  afterAll(resetDatabase)

  it('stores a client and returns it', async () => {
    const email = uniqueEmail('ana')
    const { data, error } = await adminDb()
      .from('clients')
      .insert({ email, full_name: 'Ana Ruiz', city: 'Reus' })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.full_name).toBe('Ana Ruiz')
    expect(data?.user_id).toBeNull()
  })

  it('treats client email as case insensitive and unique', async () => {
    const db = adminDb()
    const email = uniqueEmail('Carlos')
    await db.from('clients').insert({ email, full_name: 'Carlos' })

    const { error } = await db
      .from('clients')
      .insert({ email: email.toUpperCase(), full_name: 'Carlos again' })

    expect(error?.code).toBe('23505')
  })

  it('rejects a quote whose status is not in the enum', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('eva'), full_name: 'Eva' })
      .select()
      .single()

    const { error } = await db.from('quotes').insert({
      client_id: client!.id,
      reference: 'Q-2026-9001',
      title: 'Piscina 8x4',
      status: 'pendiente',
      access_token: 'token-enum-check',
    })

    expect(error).not.toBeNull()
  })

  it('allows a quote with no project, and links one later', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('luis'), full_name: 'Luis' })
      .select()
      .single()

    const { data: quote, error } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9002',
        title: 'Mantenimiento anual',
        access_token: 'token-nullable-project',
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(quote?.project_id).toBeNull()
    expect(quote?.status).toBe('draft')
  })

  it('deletes quote items when their quote is deleted', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('mar'), full_name: 'Mar' })
      .select()
      .single()
    const { data: quote } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9003',
        title: 'Reforma',
        access_token: 'token-cascade',
      })
      .select()
      .single()
    await db.from('quote_items').insert({
      quote_id: quote!.id,
      name: 'Gresite',
      unit: 'm2',
      quantity: 40,
      unit_price: 32.5,
      position: 1,
    })

    await db.from('quotes').delete().eq('id', quote!.id)

    const { data: orphans } = await db
      .from('quote_items')
      .select()
      .eq('quote_id', quote!.id)
    expect(orphans).toEqual([])
  })

  it('refuses a discount outside 0 to 100', async () => {
    const db = adminDb()
    const { data: client } = await db
      .from('clients')
      .insert({ email: uniqueEmail('nuria'), full_name: 'Nuria' })
      .select()
      .single()
    const { data: quote } = await db
      .from('quotes')
      .insert({
        client_id: client!.id,
        reference: 'Q-2026-9004',
        title: 'Depuradora',
        access_token: 'token-discount',
      })
      .select()
      .single()

    const { error } = await db.from('quote_items').insert({
      quote_id: quote!.id,
      name: 'Bomba',
      unit: 'unit',
      quantity: 1,
      unit_price: 400,
      discount_pct: 150,
      position: 1,
    })

    expect(error?.code).toBe('23514')
  })
})
