import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'
import type { SupabaseClient } from '@supabase/supabase-js'

let staff: SupabaseClient
let client: SupabaseClient
let quoteId: string
let projectId: string

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
})

afterAll(resetDatabase)

describe('client_quote_items', () => {
  it('does not expose unit_cost', async () => {
    const { data } = await client.from('client_quote_items').select('*')
    expect(data!.length).toBe(4)
    expect(Object.keys(data![0]!)).not.toContain('unit_cost')
  })

  it('returns nothing for a quote belonging to somebody else', async () => {
    const other = await createUser(uniqueEmail('other'))
    const { data } = await other.db.from('client_quote_items').select('*')
    expect(data).toEqual([])
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
})

describe('client_projects', () => {
  it('shows a client their own project without notes', async () => {
    const { data } = await client.from('client_projects').select('*').eq('id', projectId)
    expect(data).toHaveLength(1)
    expect(Object.keys(data![0]!)).not.toContain('notes')
  })

  it('hides the project from another customer', async () => {
    const other = await createUser(uniqueEmail('other-project'))
    const { data } = await other.db.from('client_projects').select('id').eq('id', projectId)
    expect(data).toEqual([])
  })
})

describe('projects table (admin)', () => {
  it('lets an admin read notes from the base table', async () => {
    const { data } = await staff.from('projects').select('notes').eq('id', projectId).single()
    expect(data!.notes).toBe('cliente exigente, cuidado con los plazos')
  })
})
