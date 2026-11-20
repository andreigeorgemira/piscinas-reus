import { beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'

/**
 * 0018_company_settings.sql and 0019_quote_vat_and_presentation.sql: the
 * letterhead, VAT per quote, totals that count ticked extras, and groups whose
 * prices the client is not shown -- by the database, not by the page.
 */
let staff: SupabaseClient
let customer: SupabaseClient
let visitor: SupabaseClient
let clientId: string

type Line = {
  name: string
  group_name: string | null
  quantity: number
  unit_price: number
  unit_cost?: number
  is_recommended?: boolean
  discount_pct?: number
}

async function quoteWith(lines: Line[], vatRate: number | null = null): Promise<string> {
  const { data, error } = await staff
    .from('quotes')
    .insert({ client_id: clientId, title: 'Piscina', vat_rate: vatRate })
    .select('id')
    .single()
  if (error) throw error
  const inserted = await staff.from('quote_items').insert(
    lines.map((line, index) => ({
      quote_id: data!.id,
      unit: 'unit',
      unit_cost: 0,
      is_recommended: false,
      discount_pct: 0,
      position: index + 1,
      ...line,
    })),
  )
  if (inserted.error) throw inserted.error
  return data!.id
}

async function send(id: string): Promise<string> {
  const moved = await staff.rpc('set_quote_status', { p_quote_id: id, p_status: 'sent' })
  if (moved.error) throw moved.error
  const { data } = await staff.from('quotes').select('access_token').eq('id', id).single()
  return data!.access_token
}

beforeAll(async () => {
  await resetDatabase()
  const boss = await createUser(uniqueEmail('presentation-staff'))
  await makeAdmin(boss.id)
  staff = boss.db
  visitor = anonDb()

  const email = uniqueEmail('presentation-client')
  const { data, error } = await adminDb()
    .from('clients')
    .insert({ email, full_name: 'Familia Pons' })
    .select('id')
    .single()
  if (error) throw error
  clientId = data!.id
  // Signing up with the same address links the account to that record (0008).
  customer = (await createUser(email)).db
})

describe('company settings', () => {
  it('are read and changed by staff', async () => {
    const changed = await staff
      .from('company_settings')
      .update({ legal_name: 'Piscinas Reus S.L.', tax_id: 'B43123456' })
      .eq('id', true)
      .select('legal_name, tax_id, default_vat_rate')
      .single()
    expect(changed.error).toBeNull()
    expect(changed.data).toEqual({ legal_name: 'Piscinas Reus S.L.', tax_id: 'B43123456', default_vat_rate: 21 })
  })

  it('are not readable by a client or a visitor', async () => {
    const asClient = await customer.from('company_settings').select('trade_name')
    expect(asClient.data ?? []).toHaveLength(0)
    const asVisitor = await visitor.from('company_settings').select('trade_name')
    expect(asVisitor.error).not.toBeNull()
  })

  it('reach the client as the letterhead of their quote, without the default VAT', async () => {
    const token = await send(await quoteWith([{ name: 'Vaso', group_name: 'Obra', quantity: 1, unit_price: 100 }]))
    const { data } = await visitor.rpc('quote_by_token', { p_token: token })
    expect(data.company).toMatchObject({ trade_name: 'Piscinas Reus', legal_name: 'Piscinas Reus S.L.', tax_id: 'B43123456' })
    expect(data.company).not.toHaveProperty('default_vat_rate')
  })
})

describe('totals', () => {
  it('charge VAT at the quote’s own rate', async () => {
    const id = await quoteWith([{ name: 'Vaso', group_name: 'Obra', quantity: 3, unit_price: 333.33 }], 21)
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', id).single()
    expect(data).toMatchObject({ grand_total: 999.99, vat_rate: 21, vat_total: 210, total_with_vat: 1209.99 })
  })

  it('carry no VAT when the quote has no rate', async () => {
    const id = await quoteWith([{ name: 'Vaso', group_name: 'Obra', quantity: 1, unit_price: 500 }])
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', id).single()
    expect(data).toMatchObject({ grand_total: 500, vat_rate: null, vat_total: 0, total_with_vat: 500 })
  })

  it('count the cost of an extra once the client ticks it', async () => {
    const id = await quoteWith([
      { name: 'Vaso', group_name: 'Obra', quantity: 1, unit_price: 1000, unit_cost: 600 },
      { name: 'Foco', group_name: 'Luz', quantity: 2, unit_price: 150, unit_cost: 60, is_recommended: true },
    ])
    const before = await staff.from('quote_totals').select('cost_total, margin').eq('quote_id', id).single()
    expect(before.data).toEqual({ cost_total: 600, margin: 400 })

    const token = await send(id)
    const { data: page } = await visitor.rpc('quote_by_token', { p_token: token })
    const extra = page.items.find((item: { is_recommended: boolean }) => item.is_recommended)
    await visitor.rpc('set_quote_extra_by_token', { p_token: token, p_item_id: extra.id, p_selected: true })

    const after = await staff.from('quote_totals').select('grand_total, cost_total, margin').eq('quote_id', id).single()
    expect(after.data).toEqual({ grand_total: 1300, cost_total: 720, margin: 580 })
  })

  it('reach the client with VAT', async () => {
    const token = await send(await quoteWith([{ name: 'Vaso', group_name: 'Obra', quantity: 1, unit_price: 1000 }], 10))
    const { data } = await visitor.rpc('quote_by_token', { p_token: token })
    expect(data.vat_rate).toBe(10)
    expect(data.totals).toMatchObject({ grand_total: 1000, vat_total: 100, total_with_vat: 1100 })

    const { data: portal } = await customer.from('client_quote_totals').select('vat_total, total_with_vat')
    expect(portal).toContainEqual({ vat_total: 100, total_with_vat: 1100 })
  })
})

describe('group presentation', () => {
  async function presentedQuote(): Promise<string> {
    const id = await quoteWith([
      { name: 'Excavación', group_name: 'Obra civil', quantity: 10, unit_price: 50 },
      { name: 'Hormigón', group_name: 'Obra civil', quantity: 10, unit_price: 100 },
      { name: 'Gresite', group_name: 'Revestimiento', quantity: 20, unit_price: 30 },
      { name: 'Depuradora', group_name: 'Equipos', quantity: 1, unit_price: 800 },
      { name: 'Foco', group_name: 'Obra civil', quantity: 1, unit_price: 145, is_recommended: true },
    ])
    const settings = await staff.from('quote_groups').insert([
      { quote_id: id, name: 'Obra civil', display: 'total_only', position: 1 },
      { quote_id: id, name: 'Revestimiento', display: 'no_prices', position: 2 },
    ])
    if (settings.error) throw settings.error
    return id
  }

  it('hides from the client what a group that is not detailed keeps to itself, and only that', async () => {
    const token = await send(await presentedQuote())
    const { data } = await visitor.rpc('quote_by_token', { p_token: token })

    const byName = new Map(data.items.map((item: { name: string }) => [item.name, item]))
    // Solo total: not a line of it leaves the database.
    expect(byName.has('Excavación')).toBe(false)
    expect(byName.has('Hormigón')).toBe(false)
    // Sin precios: the line and its quantity, nothing priced.
    expect(byName.get('Gresite')).toMatchObject({ unit_price: null, line_total: null, discount_pct: null, quantity: 20 })
    expect(byName.get('Depuradora')).toMatchObject({ unit_price: 800, line_total: 800 })
    // An extra is a choice with a price: never hidden.
    expect(byName.get('Foco')).toMatchObject({ unit_price: 145, line_total: 145 })

    expect(data.groups).toEqual([
      { name: 'Obra civil', display: 'total_only', subtotal: 1500 },
      { name: 'Revestimiento', display: 'no_prices', subtotal: 600 },
      { name: 'Equipos', display: 'detailed', subtotal: 800 },
    ])
  })

  it('hides them from the client’s own portal views too', async () => {
    const id = await presentedQuote()
    await send(id)
    const { data } = await customer
      .from('client_quote_items')
      .select('name, unit_price, line_total')
      .eq('quote_id', id)
    expect(data!.some((row) => row.name === 'Hormigón')).toBe(false)
    expect(data).toContainEqual({ name: 'Gresite', unit_price: null, line_total: null })
    expect(data).toContainEqual({ name: 'Depuradora', unit_price: 800, line_total: 800 })
  })

  it('freezes with the quote once it is sent', async () => {
    const id = await presentedQuote()
    await send(id)
    const { error } = await staff
      .from('quote_groups')
      .update({ display: 'detailed' })
      .eq('quote_id', id)
      .eq('name', 'Obra civil')
    expect(error?.message).toMatch(/cannot be edited/)
  })

  it('renames a group with its lines and its settings', async () => {
    const id = await presentedQuote()
    const { error } = await staff.rpc('rename_quote_group', { p_quote_id: id, p_from: 'Obra civil', p_to: 'Construcción' })
    expect(error).toBeNull()

    const lines = await staff.from('quote_items').select('group_name').eq('quote_id', id).eq('name', 'Excavación').single()
    expect(lines.data!.group_name).toBe('Construcción')
    const group = await staff.from('quote_groups').select('display').eq('quote_id', id).eq('name', 'Construcción').single()
    expect(group.data!.display).toBe('total_only')
  })

  it('merges into a group that already exists, keeping the stricter of the two displays', async () => {
    const id = await presentedQuote()
    await staff.rpc('rename_quote_group', { p_quote_id: id, p_from: 'Obra civil', p_to: 'Revestimiento' })

    // Obra civil was a total only: merging it must not reveal its prices.
    const { data: groups } = await staff.from('quote_groups').select('name, display').eq('quote_id', id)
    expect(groups).toEqual([{ name: 'Revestimiento', display: 'total_only' }])
    const { count } = await staff
      .from('quote_items')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', id)
      .eq('group_name', 'Revestimiento')
    expect(count).toBe(4)
  })

  it('never carries a settings row off to another quote', async () => {
    const first = await presentedQuote()
    const second = await presentedQuote()
    const { error } = await staff
      .from('quote_groups')
      .update({ quote_id: second })
      .eq('quote_id', first)
      .eq('name', 'Equipos')
    // Equipos has no row in the fixture; move one that does.
    const moved = await staff
      .from('quote_groups')
      .update({ quote_id: second, name: 'Movido' })
      .eq('quote_id', first)
      .eq('name', 'Obra civil')
    expect(error).toBeNull()
    expect(moved.error?.message).toMatch(/cannot move to another quote/)
  })

  it('refuses an empty group name', async () => {
    const id = await presentedQuote()
    const { error } = await staff.rpc('rename_quote_group', { p_quote_id: id, p_from: 'Equipos', p_to: '   ' })
    expect(error?.message).toMatch(/1 to 80/)
  })

  it('is not readable or writable by a client', async () => {
    const id = await presentedQuote()
    const read = await customer.from('quote_groups').select('name').eq('quote_id', id)
    expect(read.data ?? []).toHaveLength(0)
    const write = await customer.from('quote_groups').insert({ quote_id: id, name: 'Mío' })
    expect(write.error).not.toBeNull()
  })
})
