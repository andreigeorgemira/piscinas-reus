import { describe, expect, it } from 'vitest'
import { initialsOf } from './brand'

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Piscinas Reus')).toBe('PR')
    expect(initialsOf('jardines del baix camp')).toBe('JD')
  })

  it('takes two letters of a single word', () => {
    expect(initialsOf('Reformas')).toBe('RE')
  })

  it('ignores punctuation-only words and survives an empty name', () => {
    expect(initialsOf('— Ávila & Hijos')).toBe('ÁH')
    expect(initialsOf('   ')).toBe('·')
  })
})
