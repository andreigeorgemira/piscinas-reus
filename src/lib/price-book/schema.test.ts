import { describe, expect, it } from 'vitest'
import {
  firstIssue,
  groupInputFromForm,
  groupInputSchema,
  itemInputFromForm,
  itemInputSchema,
  itemInputToRow,
  UNIT_LABELS,
  UNIT_TYPES,
} from './schema'

// A valid uuid, for tests that only care about the OTHER field under test.
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

function validItemInput() {
  return {
    group_id: VALID_UUID,
    code: 'ABC-1',
    name: 'Vaso de gresite',
    description: 'Revestimiento en gresite azul',
    unit: 'm2',
    unit_cost: '10,00',
    unit_price: '15,00',
    is_active: 'on',
  }
}

function formFrom(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }
  return formData
}

describe('UNIT_TYPES', () => {
  it('matches the unit_type enum in migration 0001, in order', () => {
    expect(UNIT_TYPES).toEqual(['m2', 'ml', 'unit', 'hour', 'kg', 'lot'])
  })
})

describe('UNIT_LABELS', () => {
  it('has a Spanish label for every unit', () => {
    expect(UNIT_LABELS).toEqual({
      m2: 'm²',
      ml: 'ml',
      unit: 'ud.',
      hour: 'hora',
      kg: 'kg',
      lot: 'partida',
    })
  })
})

describe('groupInputSchema', () => {
  it('trims the name and accepts a valid position', () => {
    const result = groupInputSchema.parse({ name: '  Obra civil  ', position: 3 })
    expect(result).toEqual({ name: 'Obra civil', position: 3 })
  })

  it('rejects a blank name', () => {
    const result = groupInputSchema.safeParse({ name: '   ', position: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a name over 80 characters', () => {
    const result = groupInputSchema.safeParse({ name: 'a'.repeat(81), position: 0 })
    expect(result.success).toBe(false)
  })

  it('defaults an empty position to 0', () => {
    const result = groupInputSchema.parse({ name: 'Obra civil', position: '' })
    expect(result.position).toBe(0)
  })

  it('rejects a missing name with a Spanish message, not zod\'s English default', () => {
    const result = groupInputSchema.safeParse({ name: null, position: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toBe('El nombre del grupo es obligatorio.')
    }
  })

  it('rejects a non-numeric position with a Spanish message, not zod\'s English default', () => {
    const result = groupInputSchema.safeParse({ name: 'Obra civil', position: 'abc' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toBe('La posición no es válida.')
    }
  })
})

describe('itemInputSchema', () => {
  it('accepts a fully valid item and converts prices from Spanish notation', () => {
    const result = itemInputSchema.parse({
      groupId: VALID_UUID,
      code: 'ABC-1',
      name: 'Vaso de gresite',
      description: 'Revestimiento en gresite azul',
      unit: 'm2',
      unitCost: '10,00',
      unitPrice: '32,50',
      isActive: true,
    })
    expect(result).toEqual({
      groupId: VALID_UUID,
      code: 'ABC-1',
      name: 'Vaso de gresite',
      description: 'Revestimiento en gresite azul',
      unit: 'm2',
      unitCost: 10,
      unitPrice: 32.5,
      isActive: true,
    })
  })

  it('turns an empty code into null, not an empty string', () => {
    const result = itemInputSchema.parse({
      groupId: null,
      code: '',
      name: 'Vaso de gresite',
      description: '',
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.code).toBeNull()
  })

  it('turns an empty description into null', () => {
    const result = itemInputSchema.parse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: '   ',
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.description).toBeNull()
  })

  it('turns an empty group id into null', () => {
    const result = itemInputSchema.parse({
      groupId: '',
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.groupId).toBeNull()
  })

  it('rejects a non-uuid group id', () => {
    const result = itemInputSchema.safeParse({
      groupId: 'not-a-uuid',
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a blank name', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: '   ',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing name with a Spanish message, not zod\'s English default', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: null,
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toBe('El nombre es obligatorio.')
    }
  })

  it('rejects a missing price with a Spanish message, not zod\'s English default', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: null,
      isActive: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toBe('El precio es obligatorio.')
    }
  })

  it('rejects a unit outside the enum', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'litre',
      unitCost: '0',
      unitPrice: '0',
      isActive: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-numeric price with a message mentioning "precio"', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: 'gratis',
      isActive: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toContain('precio')
    }
  })

  it('rejects a negative price', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '-5',
      isActive: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a price with more than two decimals, mentioning "decimales"', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '32,505',
      isActive: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(firstIssue(result.error)).toContain('decimales')
    }
  })

  it('rejects a price above the business ceiling -- numeric(12,2) would hold it', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '0',
      unitPrice: '10000000',
      isActive: false,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a price below cost -- the company sometimes sells at a loss to win a job', () => {
    const result = itemInputSchema.safeParse({
      groupId: null,
      code: null,
      name: 'Vaso de gresite',
      description: null,
      unit: 'unit',
      unitCost: '100',
      unitPrice: '50',
      isActive: false,
    })
    expect(result.success).toBe(true)
  })
})

describe('itemInputFromForm', () => {
  it('reads an absent checkbox as false', () => {
    const formData = formFrom(validItemInput())
    formData.delete('is_active')
    const result = itemInputFromForm(formData) as Record<string, unknown>
    expect(result.isActive).toBe(false)
  })

  it('reads a checked checkbox as true', () => {
    const formData = formFrom(validItemInput())
    const result = itemInputFromForm(formData) as Record<string, unknown>
    expect(result.isActive).toBe(true)
  })

  it('produces camelCase keys parseable by itemInputSchema', () => {
    const formData = formFrom(validItemInput())
    const raw = itemInputFromForm(formData)
    const parsed = itemInputSchema.parse(raw)
    expect(parsed.name).toBe('Vaso de gresite')
    expect(parsed.unitPrice).toBe(15)
  })
})

describe('groupInputFromForm', () => {
  it('produces keys parseable by groupInputSchema', () => {
    const formData = formFrom({ name: 'Obra civil', position: '2' })
    const parsed = groupInputSchema.parse(groupInputFromForm(formData))
    expect(parsed).toEqual({ name: 'Obra civil', position: 2 })
  })
})

describe('itemInputToRow', () => {
  it('produces the exact snake_case column names price_book_items takes', () => {
    const input = itemInputSchema.parse({
      groupId: VALID_UUID,
      code: 'ABC-1',
      name: 'Vaso de gresite',
      description: 'Revestimiento en gresite azul',
      unit: 'm2',
      unitCost: '10,00',
      unitPrice: '15,00',
      isActive: true,
    })
    expect(itemInputToRow(input)).toEqual({
      group_id: VALID_UUID,
      code: 'ABC-1',
      name: 'Vaso de gresite',
      description: 'Revestimiento en gresite azul',
      unit: 'm2',
      unit_cost: 10,
      unit_price: 15,
      is_active: true,
    })
  })
})
