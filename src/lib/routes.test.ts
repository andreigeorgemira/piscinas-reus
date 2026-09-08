import { describe, expect, it } from 'vitest'
import { isAdminPath, isLoginPath, isProtectedPath } from './routes'

describe('isAdminPath', () => {
  it('matches the dashboard and everything under it', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/')).toBe(true)
    expect(isAdminPath('/admin/clients/7')).toBe(true)
  })

  it('matches a path that only reaches /admin after normalisation', () => {
    // The reason this module exists: `'/./admin'.startsWith('/admin')` is
    // false, but a browser sent to /./admin lands on /admin.
    expect(isAdminPath('/./admin')).toBe(true)
    expect(isAdminPath('/portal/../admin')).toBe(true)
    expect(isAdminPath('/admin/../admin/clients')).toBe(true)
  })

  it('ignores the query string and the fragment', () => {
    expect(isAdminPath('/admin?tab=clients')).toBe(true)
    expect(isAdminPath('/portal?next=/admin')).toBe(false)
    expect(isAdminPath('/portal#/admin')).toBe(false)
  })

  it('does not match a path that normalises out of the dashboard', () => {
    expect(isAdminPath('/portal')).toBe(false)
    expect(isAdminPath('/admin/../portal')).toBe(false)
    expect(isAdminPath('/login')).toBe(false)
  })
})

describe('isProtectedPath', () => {
  it('covers both signed-in areas', () => {
    expect(isProtectedPath('/admin')).toBe(true)
    expect(isProtectedPath('/portal')).toBe(true)
    expect(isProtectedPath('/./portal/quotes/42')).toBe(true)
  })

  it('leaves the public pages alone', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/login')).toBe(false)
    expect(isProtectedPath('/portal/../')).toBe(false)
  })
})

describe('isLoginPath', () => {
  it('recognises the sign-in form however it is spelled', () => {
    expect(isLoginPath('/login')).toBe(true)
    expect(isLoginPath('/login/')).toBe(true)
    expect(isLoginPath('/./login')).toBe(true)
    expect(isLoginPath('/login?next=%2Fadmin')).toBe(true)
  })

  it('does not claim anything else', () => {
    expect(isLoginPath('/admin')).toBe(false)
    expect(isLoginPath('/portal')).toBe(false)
  })
})
