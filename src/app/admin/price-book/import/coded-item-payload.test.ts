import { describe, expect, it } from 'vitest'
import type { ItemInput } from '@/lib/price-book/schema'
import { codedItemPayload } from './coded-item-payload'

const BASE_INPUT: ItemInput = {
  groupId: null,
  code: 'REV-001',
  name: 'Gresite azul importado',
  description: 'Actualizado por importacion',
  unit: 'm2',
  unitCost: 19,
  unitPrice: 35,
  // The CSV column contract has no "activo" column, so every parsed row
  // carries this placeholder. codedItemPayload must never let it reach the
  // database, or a retired item named in the file would be reactivated.
  isActive: true,
}

describe('codedItemPayload', () => {
  it('never carries is_active, regardless of whether the file had a description column', () => {
    expect(codedItemPayload(BASE_INPUT, true)).not.toHaveProperty('is_active')
    expect(codedItemPayload(BASE_INPUT, false)).not.toHaveProperty('is_active')
  })

  it('includes description when the file had a descripcion column', () => {
    const payload = codedItemPayload(BASE_INPUT, true)

    expect(payload).toHaveProperty('description', 'Actualizado por importacion')
  })

  it('omits description entirely when the file had no descripcion column', () => {
    const payload = codedItemPayload(BASE_INPUT, false)

    expect(payload).not.toHaveProperty('description')
  })

  it('still carries every other field the write needs', () => {
    const payload = codedItemPayload({ ...BASE_INPUT, groupId: 'a-group-id' }, false)

    expect(payload).toMatchObject({
      group_id: 'a-group-id',
      code: 'REV-001',
      name: 'Gresite azul importado',
      unit: 'm2',
      unit_cost: 19,
      unit_price: 35,
    })
  })
})
