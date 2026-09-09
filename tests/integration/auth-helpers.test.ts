import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { adminDb, anonDb, createUser, makeAdmin, resetDatabase, uniqueEmail } from './helpers/db'

describe('authorization helpers', () => {
  beforeAll(resetDatabase)
  afterAll(resetDatabase)

  it('reports false for a plain user', async () => {
    const { db } = await createUser(uniqueEmail('plain'))
    const { data } = await db.rpc('is_admin')
    expect(data).toBe(false)
  })

  it('reports true once the profile role is admin', async () => {
    // The account-linking trigger (migration 0008) creates the profiles
    // row automatically once the email is confirmed.
    const { id, db } = await createUser(uniqueEmail('boss'))
    await makeAdmin(id)
    const { data } = await db.rpc('is_admin')
    expect(data).toBe(true)
  })

  it('reports false for an anonymous caller', async () => {
    const { data } = await anonDb().rpc('is_admin')
    expect(data).toBe(false)
  })

  it('gives an admin and a plain user different answers in the same run', async () => {
    // A hardcoded-false (or hardcoded-true) implementation would pass the
    // single-caller tests above; this only passes if is_admin actually
    // distinguishes the two callers.
    const admin = await createUser(uniqueEmail('boss2'))
    await makeAdmin(admin.id)

    const plain = await createUser(uniqueEmail('plain2'))

    const [adminResult, plainResult] = await Promise.all([
      admin.db.rpc('is_admin'),
      plain.db.rpc('is_admin'),
    ])

    expect(adminResult.data).toBe(true)
    expect(plainResult.data).toBe(false)
    expect(adminResult.data).not.toBe(plainResult.data)
  })

  it('resolves null for a caller with no client row', async () => {
    const { data } = await anonDb().rpc('current_client_id')
    expect(data).toBeNull()
  })

  it('resolves the caller\'s own client id when one is linked', async () => {
    const { id: userId, db } = await createUser(uniqueEmail('linked'))
    // The account-linking trigger (migration 0008) creates the clients row
    // automatically once the email is confirmed.
    const { data: client, error } = await adminDb()
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single()
    if (error) throw error

    const { data } = await db.rpc('current_client_id')
    expect(data).toBe(client.id)
  })
})
