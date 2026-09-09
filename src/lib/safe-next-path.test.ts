import { describe, expect, it } from 'vitest'
import { safeNextPath } from './safe-next-path'

describe('safeNextPath', () => {
  it('accepts a same-site absolute path', () => {
    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath('/portal/quotes/42?tab=items')).toBe(
      '/portal/quotes/42?tab=items',
    )
  })

  it('rejects an absolute URL to another site', () => {
    expect(safeNextPath('https://evil.example/')).toBeNull()
    expect(safeNextPath('http://evil.example/')).toBeNull()
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeNextPath('//evil.example/')).toBeNull()
  })

  it('rejects a backslash-escaped host, which browsers read as //', () => {
    expect(safeNextPath('/\\evil.example/')).toBeNull()
  })

  it('rejects control characters a browser would strip', () => {
    expect(safeNextPath('/\nhttps://evil.example')).toBeNull()
    expect(safeNextPath('/\thttps://evil.example')).toBeNull()
  })

  it('rejects a relative path and anything that is not a string', () => {
    expect(safeNextPath('admin')).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath(['/admin', '/portal'])).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })
})
