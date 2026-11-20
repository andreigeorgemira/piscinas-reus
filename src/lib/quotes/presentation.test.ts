import { describe, expect, it } from 'vitest'
import { displayOf, documentSections, isGroupDisplay, presentationOrder, type GroupSetting } from './presentation'

type Line = { id: string; groupName: string | null; isRecommended: boolean }

function line(id: string, groupName: string | null, isRecommended = false): Line {
  return { id, groupName, isRecommended }
}

const ids = (lines: Line[]) => lines.map((l) => l.id)

describe('presentationOrder', () => {
  it('keeps the catalogue order when no group has been placed', () => {
    const lines = [line('a', 'Obra'), line('b', 'Obra'), line('c', 'Equipos')]
    expect(ids(presentationOrder(lines, []))).toEqual(['a', 'b', 'c'])
  })

  it('puts placed groups first, by their position', () => {
    const lines = [line('a', 'Obra'), line('b', 'Equipos'), line('c', 'Luz')]
    const settings: GroupSetting[] = [
      { name: 'Luz', position: 1, display: 'detailed' },
      { name: 'Obra', position: 2, display: 'detailed' },
    ]
    expect(ids(presentationOrder(lines, settings))).toEqual(['c', 'a', 'b'])
  })

  it('never splits a group the catalogue scattered', () => {
    // A custom group gathers concepts from two catalogue groups: its lines
    // arrive apart and are printed together, where the first of them was.
    const lines = [line('a', 'Obra civil'), line('b', 'Revestimiento'), line('c', 'Obra civil')]
    expect(ids(presentationOrder(lines, []))).toEqual(['a', 'c', 'b'])
  })

  it('keeps the lines with no group as a group of their own', () => {
    const lines = [line('a', null), line('b', 'Obra'), line('c', null)]
    expect(ids(presentationOrder(lines, [{ name: 'Obra', position: 1, display: 'detailed' }]))).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('ignores settings for groups the quote no longer has', () => {
    const lines = [line('a', 'Obra')]
    expect(ids(presentationOrder(lines, [{ name: 'Borrado', position: 1, display: 'total_only' }]))).toEqual(['a'])
  })
})

describe('documentSections', () => {
  it('cuts the base lines into groups with their display, leaving extras out', () => {
    const lines = [line('a', 'Obra'), line('b', 'Obra'), line('x', 'Obra', true), line('c', 'Equipos')]
    const sections = documentSections(lines, [{ name: 'Obra', position: 1, display: 'no_prices' }])
    expect(sections.map((s) => [s.groupName, s.display, ids(s.lines)])).toEqual([
      ['Obra', 'no_prices', ['a', 'b']],
      ['Equipos', 'detailed', ['c']],
    ])
  })
})

describe('displayOf', () => {
  it('is detailed for a group with no setting and for the ungrouped lines', () => {
    expect(displayOf('Obra', [])).toBe('detailed')
    expect(displayOf(null, [{ name: 'Obra', position: 0, display: 'total_only' }])).toBe('detailed')
  })
})

describe('isGroupDisplay', () => {
  it('accepts the three modes and nothing else', () => {
    expect(isGroupDisplay('total_only')).toBe(true)
    expect(isGroupDisplay('everything')).toBe(false)
    expect(isGroupDisplay(null)).toBe(false)
  })
})
