import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('getPublicEnv', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns the parsed public configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(getPublicEnv()).toEqual({
      supabaseUrl: 'https://demo.supabase.co',
      supabasePublishableKey: 'sb_publishable_xyz',
      siteUrl: 'http://localhost:3000',
    })
  })

  it('names the missing variable in the error message', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(() => getPublicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('rejects a url that is not a url', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_xyz')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')

    const { getPublicEnv } = await import('./env')
    expect(() => getPublicEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})

describe('getServerEnv', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns the service role key', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    const { getServerEnv } = await import('./env')
    expect(getServerEnv().serviceRoleKey).toBe('service-key')
  })

  it('fails loudly when the service role key is absent', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { getServerEnv } = await import('./env')
    expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})
