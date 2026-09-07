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
    const { id, db } = await createUser(uniqueEmail('boss'))
    // The trigger that creates a profiles row on signup does not exist until
    // Task 9, so the row is inserted here rather than assumed to exist.
    const { error } = await adminDb().from('profiles').insert({ id })
    if (error) throw error
    await makeAdmin(id)
    const { data } = await db.rpc('is_admin')
    expect(data).toBe(true)
  })

  it('reports false for an anonymous caller', async () => {
    const { data } = await anonDb().rpc('is_admin')
    expect(data).toBe(false)
  })

  it('resolves null for a caller with no client row', async () => {
    const { data } = await anonDb().rpc('current_client_id')
    expect(data).toBeNull()
  })
})
