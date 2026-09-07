import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('createAdminSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
  })

  it('builds a client when the service role key is present', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    const { createAdminSupabaseClient } = await import('./admin')
    expect(createAdminSupabaseClient().from('clients')).toBeDefined()
  })

  it('refuses to build without a service role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { createAdminSupabaseClient } = await import('./admin')
    expect(() => createAdminSupabaseClient()).toThrowError(
      /SUPABASE_SERVICE_ROLE_KEY/,
    )
  })
})
