import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let client: SupabaseClient
let quoteId: string
let projectId: string
let otherClient: SupabaseClient
let otherQuoteId: string
let otherProjectId: string
let otherItemId: string
let roundingClient: SupabaseClient
let roundingQuoteId: string

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

  const person = await createUser(uniqueEmail('client'))
  client = person.db
  // Same workaround: the signup trigger that links auth.users to clients
  // does not exist until Task 9, so the row is created directly.
  await db
    .from('clients')
    .insert({ user_id: person.id, email: uniqueEmail('client-row'), full_name: 'Cliente' })
  const { data: row } = await db.from('clients').select().eq('user_id', person.id).single()

  const { data: project } = await db
    .from('projects')
    .insert({
      client_id: row!.id,
      reference: 'PRJ-2026-7001',
      name: 'Piscina con extras',
      notes: 'cliente exigente, cuidado con los plazos',
    })
    .select()
    .single()
  projectId = project!.id

  const { data: quote } = await db
    .from('quotes')
    .insert({
      client_id: row!.id,
      project_id: projectId,
      reference: 'Q-2026-7001',
      title: 'Piscina con extras',
      access_token: 'token-views',
    })
    .select()
    .single()
  quoteId = quote!.id

  // Every object below repeats discount_pct, is_recommended and
  // client_selected explicitly, even where the value is the column default.
  // PostgREST's bulk insert derives its column list from the union of keys
  // across all rows in the array; a row missing a key that a sibling row
  // sets is sent as an explicit NULL rather than falling back to the
  // schema default, which trips the NOT NULL constraints on this table.
  await db.from('quote_items').insert([
    // 40 * 32.50 = 1300.00
    { quote_id: quoteId, name: 'Gresite', unit: 'm2', quantity: 40,
      unit_cost: 18, unit_price: 32.5, discount_pct: 0,
      is_recommended: false, client_selected: false, position: 1 },
    // 1 * 2000 with 10% off = 1800.00
    { quote_id: quoteId, name: 'Excavacion', unit: 'lot', quantity: 1,
      unit_cost: 1200, unit_price: 2000, discount_pct: 10,
      is_recommended: false, client_selected: false, position: 2 },
    // recommended, excluded from the base total
    { quote_id: quoteId, name: 'Cobertor termico', unit: 'unit', quantity: 1,
      unit_cost: 300, unit_price: 650, discount_pct: 0,
      is_recommended: true, client_selected: false, position: 3 },
    // recommended and selected by the client
    { quote_id: quoteId, name: 'Iluminacion LED', unit: 'unit', quantity: 2,
      unit_cost: 60, unit_price: 145, discount_pct: 0,
      is_recommended: true, client_selected: true, position: 4 },
  ])

  // Sent only now: Task 10 freezes line items once a quote leaves draft.
  await db.from('quotes').update({ status: 'sent' }).eq('id', quoteId)

  // A second, unrelated customer with their own real fixture (own clients
  // row, own project, own quote and own line item). Cross-customer
  // isolation must be proven against a real second customer, not a user
  // with no clients row at all: current_client_id() returns null for such
  // a user, so every view would return nothing regardless of whether the
  // ownership filter actually compares the right column.
  const otherPerson = await createUser(uniqueEmail('other'))
  otherClient = otherPerson.db
  await db
    .from('clients')
    .insert({ user_id: otherPerson.id, email: uniqueEmail('other-row'), full_name: 'Otro cliente' })
  const { data: otherRow } = await db.from('clients').select().eq('user_id', otherPerson.id).single()

  const { data: otherProject } = await db
    .from('projects')
    .insert({
      client_id: otherRow!.id,
      reference: 'PRJ-2026-7002',
      name: 'Piscina de otro cliente',
      notes: 'notas privadas de otro cliente',
    })
    .select()
    .single()
  otherProjectId = otherProject!.id

  const { data: otherQuote } = await db
    .from('quotes')
    .insert({
      client_id: otherRow!.id,
      project_id: otherProjectId,
      reference: 'Q-2026-7002',
      title: 'Piscina de otro cliente',
      access_token: 'token-views-other',
    })
    .select()
    .single()
  otherQuoteId = otherQuote!.id

  const { data: otherItems } = await db
    .from('quote_items')
    .insert([
      { quote_id: otherQuoteId, name: 'Vaso', unit: 'lot', quantity: 1,
        unit_cost: 500, unit_price: 900, discount_pct: 0,
        is_recommended: false, client_selected: false, position: 1 },
    ])
    .select()
  otherItemId = otherItems![0]!.id

  // Built as a draft, filled, then promoted, same as the quote above.
  await db.from('quotes').update({ status: 'sent' }).eq('id', otherQuoteId)

  // A third, separate customer whose only quote is chosen to distinguish
  // "round each line then sum" from "sum then round once": both lines are
  // non-recommended, quantity 1, unit_price 10.05, discount_pct 50, so each
  // line is 10.05 * 0.5 = 5.025 unrounded before any rounding is applied.
  // A separate customer (rather than reusing A's or B's) keeps this quote
  // out of the unfiltered client_quote_items queries above, so the existing
  // item counts and totals for A and B are undisturbed.
  const roundingPerson = await createUser(uniqueEmail('rounding'))
  roundingClient = roundingPerson.db
  await db
    .from('clients')
    .insert({ user_id: roundingPerson.id, email: uniqueEmail('rounding-row'), full_name: 'Cliente redondeo' })
  const { data: roundingRow } = await db
    .from('clients')
    .select()
    .eq('user_id', roundingPerson.id)
    .single()

  const { data: roundingQuote } = await db
    .from('quotes')
    .insert({
      client_id: roundingRow!.id,
      reference: 'Q-2026-7003',
      title: 'Ajuste de redondeo',
      access_token: 'token-views-rounding',
    })
    .select()
    .single()
  roundingQuoteId = roundingQuote!.id

  await db.from('quote_items').insert([
    { quote_id: roundingQuoteId, name: 'Linea A', unit: 'unit', quantity: 1,
      unit_cost: 0, unit_price: 10.05, discount_pct: 50,
      is_recommended: false, client_selected: false, position: 1 },
    { quote_id: roundingQuoteId, name: 'Linea B', unit: 'unit', quantity: 1,
      unit_cost: 0, unit_price: 10.05, discount_pct: 50,
      is_recommended: false, client_selected: false, position: 2 },
  ])

  await db.from('quotes').update({ status: 'sent' }).eq('id', roundingQuoteId)
})

afterAll(resetDatabase)

describe('client_quote_items', () => {
  it('does not expose unit_cost', async () => {
    const { data } = await client.from('client_quote_items').select('*')
    expect(data!.length).toBe(4)
    expect(Object.keys(data![0]!)).not.toContain('unit_cost')
  })

  it('shows customer A only their own items, never customer B\'s', async () => {
    const { data } = await client.from('client_quote_items').select('id, quote_id')
    expect(data!.length).toBe(4)
    expect(data!.every((row) => row.quote_id === quoteId)).toBe(true)
    expect(data!.map((row) => row.id)).not.toContain(otherItemId)
  })

  it('shows customer B only their own items, never customer A\'s', async () => {
    const { data } = await otherClient.from('client_quote_items').select('id, quote_id')
    expect(data).toEqual([{ id: otherItemId, quote_id: otherQuoteId }])
  })
})

describe('quote_totals', () => {
  it('sums only non-recommended lines into the base total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.base_total)).toBe(3100)
  })

  it('keeps recommended lines in their own total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.recommended_total)).toBe(940)
  })

  it('counts only the extras the client selected', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.selected_extras_total)).toBe(290)
  })

  it('adds selected extras to the grand total', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.grand_total)).toBe(3390)
  })

  it('reports cost and margin to an admin', async () => {
    const { data } = await staff.from('quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.cost_total)).toBe(1920)
    expect(Number(data!.margin)).toBe(1180)
  })
})

describe('client_quote_totals', () => {
  it('gives the client totals without cost or margin', async () => {
    const { data } = await client.from('client_quote_totals').select('*').eq('quote_id', quoteId).single()
    expect(Number(data!.grand_total)).toBe(3390)
    expect(Object.keys(data!)).not.toContain('cost_total')
    expect(Object.keys(data!)).not.toContain('margin')
  })

  it('gives customer A only their own quote totals, never customer B\'s', async () => {
    const { data } = await client.from('client_quote_totals').select('quote_id')
    const ids = data!.map((row) => row.quote_id)
    expect(ids).toContain(quoteId)
    expect(ids).not.toContain(otherQuoteId)
  })

  it('gives customer B only their own quote totals, never customer A\'s', async () => {
    const { data } = await otherClient.from('client_quote_totals').select('quote_id')
    const ids = data!.map((row) => row.quote_id)
    expect(ids).toContain(otherQuoteId)
    expect(ids).not.toContain(quoteId)
  })
})

describe('client_quotes', () => {
  it('shows customer A only their own quote, never customer B\'s', async () => {
    const { data } = await client.from('client_quotes').select('id')
    const ids = data!.map((row) => row.id)
    expect(ids).toContain(quoteId)
    expect(ids).not.toContain(otherQuoteId)
  })

  it('shows customer B only their own quote, never customer A\'s', async () => {
    const { data } = await otherClient.from('client_quotes').select('id')
    const ids = data!.map((row) => row.id)
    expect(ids).toContain(otherQuoteId)
    expect(ids).not.toContain(quoteId)
  })
})

describe('rounding order', () => {
  it('rounds each line before summing, not the sum as a whole', async () => {
    const { data } = await staff
      .from('quote_totals')
      .select('*')
      .eq('quote_id', roundingQuoteId)
      .single()
    // Each line is 1 * 10.05 * (1 - 50/100) = 5.025 unrounded.
    // Correct (round each line, then sum): round(5.025, 2) + round(5.025, 2)
    //   = 5.03 + 5.03 = 10.06 — PostgreSQL's round(numeric, int) rounds
    //   halves away from zero, so 5.025 rounds up to 5.03.
    // Wrong (sum first, round once): round(5.025 + 5.025, 2) = round(10.05, 2)
    //   = 10.05. A regression that moved round() outside sum() would produce
    //   10.05 here instead of 10.06.
    expect(Number(data!.base_total)).toBe(10.06)
    expect(Number(data!.grand_total)).toBe(10.06)
  })

  it('applies the same rounding order in the client-facing view', async () => {
    const { data } = await roundingClient
      .from('client_quote_totals')
      .select('*')
      .eq('quote_id', roundingQuoteId)
      .single()
    expect(Number(data!.grand_total)).toBe(10.06)
  })
})

describe('client_projects', () => {
  it('shows a client their own project without notes', async () => {
    const { data } = await client.from('client_projects').select('*').eq('id', projectId)
    expect(data).toHaveLength(1)
    expect(Object.keys(data![0]!)).not.toContain('notes')
  })

  it('shows customer A only their own project, never customer B\'s', async () => {
    const { data } = await client.from('client_projects').select('id')
    const ids = data!.map((row) => row.id)
    expect(ids).toContain(projectId)
    expect(ids).not.toContain(otherProjectId)
  })

  it('shows customer B only their own project, never customer A\'s', async () => {
    const { data } = await otherClient.from('client_projects').select('id')
    const ids = data!.map((row) => row.id)
    expect(ids).toContain(otherProjectId)
    expect(ids).not.toContain(projectId)
  })
})

describe('projects table (admin)', () => {
  it('lets an admin read notes from the base table', async () => {
    const { data } = await staff.from('projects').select('notes').eq('id', projectId).single()
    expect(data!.notes).toBe('cliente exigente, cuidado con los plazos')
  })
})
