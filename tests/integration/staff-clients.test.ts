import { beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'

/**
 * What 0017_staff_are_not_clients.sql promises: an account that becomes staff
 * stops being listed as a client, unless it genuinely is one.
 */
let staff: SupabaseClient

beforeAll(async () => {
  await resetDatabase()
  const boss = await createUser(uniqueEmail('staff-clients-boss'))
  await makeAdmin(boss.id)
  staff = boss.db
})

async function clientRowsFor(userId: string) {
  const { data, error } = await adminDb().from('clients').select('id, user_id').eq('user_id', userId)
  if (error) throw error
  return data!
}

describe('promoting an account to staff', () => {
  it('removes the client row the signup made for it', async () => {
    const person = await createUser(uniqueEmail('new-staff'))
    expect(await clientRowsFor(person.id)).toHaveLength(1)

    await makeAdmin(person.id)

    expect(await clientRowsFor(person.id)).toHaveLength(0)
  })

  it('keeps a client record with quotes on it, unlinked from the staff account', async () => {
    const email = uniqueEmail('client-turned-staff')
    const person = await createUser(email)
    const [row] = await clientRowsFor(person.id)

    // Written by staff: quote references are allocated to staff only (0006).
    const { error } = await staff
      .from('quotes')
      .insert({ client_id: row!.id, title: 'Antes de entrar en la empresa' })
    expect(error).toBeNull()

    await makeAdmin(person.id)

    const { data } = await adminDb().from('clients').select('id, user_id').eq('id', row!.id).single()
    expect(data).toEqual({ id: row!.id, user_id: null })
  })

  it('leaves the clients of other accounts alone', async () => {
    const customer = await createUser(uniqueEmail('a-customer'))
    const person = await createUser(uniqueEmail('another-staff'))

    await makeAdmin(person.id)

    expect(await clientRowsFor(customer.id)).toHaveLength(1)
  })
})
