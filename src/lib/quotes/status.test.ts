import { describe, expect, it } from 'vitest'
import { canMove, frozenReason, isEditable, movesFrom, QUOTE_STATUSES } from './status'

describe('the moves a quote can make', () => {
  it('sends a draft, and nothing else', () => {
    expect(movesFrom('draft')).toEqual(['sent'])
  })

  it('answers a sent quote three ways', () => {
    expect(movesFrom('sent')).toEqual(['accepted', 'rejected', 'draft'])
  })

  it('lets a responded quote be reopened', () => {
    expect(movesFrom('accepted')).toEqual(['draft'])
    expect(movesFrom('rejected')).toEqual(['draft'])
  })

  it('refuses to accept a quote that was never sent', () => {
    // The same rule set_quote_status enforces in 0013_quote_lifecycle.sql. A
    // screen that offered this button would be offering a refusal.
    expect(canMove('draft', 'accepted')).toBe(false)
    expect(canMove('draft', 'rejected')).toBe(false)
  })

  it('treats a status as unable to move to itself', () => {
    for (const status of QUOTE_STATUSES) {
      expect(canMove(status, status)).toBe(false)
    }
  })

  it('always offers the way back to draft, except from draft', () => {
    for (const status of QUOTE_STATUSES) {
      expect(canMove(status, 'draft')).toBe(status !== 'draft')
    }
  })
})

describe('when lines can be edited', () => {
  it('is only while the quote is a draft', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('sent')).toBe(false)
    expect(isEditable('accepted')).toBe(false)
    expect(isEditable('rejected')).toBe(false)
  })

  it('explains the freeze in the status it happened in', () => {
    expect(frozenReason('sent')).toContain('enviado')
    expect(frozenReason('accepted')).toContain('aceptado')
  })
})
