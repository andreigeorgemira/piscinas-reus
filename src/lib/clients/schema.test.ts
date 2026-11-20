import { describe, expect, it } from 'vitest'
import { clientInputFromForm, clientInputSchema, clientInputToRow } from './schema'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.append(name, value)
  return data
}

const valid = {
  full_name: 'Familia Soler',
  email: 'soler@example.test',
  phone: '977 123 456',
  address: 'Camí de la Pedrera 12',
  city: 'Reus',
  postal_code: '43201',
  notes: 'Portal azul, llamar antes.',
}

describe('the client form', () => {
  it('reads a filled-in form', () => {
    const parsed = clientInputSchema.safeParse(clientInputFromForm(form(valid)))

    expect(parsed.success).toBe(true)
    expect(parsed.success && clientInputToRow(parsed.data)).toEqual({
      full_name: 'Familia Soler',
      email: 'soler@example.test',
      phone: '977 123 456',
      address: 'Camí de la Pedrera 12',
      city: 'Reus',
      postal_code: '43201',
      notes: 'Portal azul, llamar antes.',
    })
  })

  it('needs a name and an email, and nothing else', () => {
    const parsed = clientInputSchema.safeParse(
      clientInputFromForm(form({ full_name: 'Solo nombre', email: 'solo@example.test' })),
    )

    expect(parsed.success).toBe(true)
    // Everything a form leaves blank is stored as null rather than '': a
    // client with no phone has no phone, and '' would make every search for
    // an empty field match it.
    expect(parsed.success && parsed.data).toMatchObject({
      phone: null,
      address: null,
      city: null,
      postalCode: null,
      notes: null,
    })
  })

  it('trims what staff paste', () => {
    const parsed = clientInputSchema.safeParse(
      clientInputFromForm(form({ full_name: '  Familia Soler  ', email: '  soler@example.test ' })),
    )

    expect(parsed.success && parsed.data.fullName).toBe('Familia Soler')
    expect(parsed.success && parsed.data.email).toBe('soler@example.test')
  })

  it('refuses a whitespace-only name', () => {
    const parsed = clientInputSchema.safeParse(clientInputFromForm(form({ ...valid, full_name: '   ' })))

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe('El nombre es obligatorio.')
  })

  it('refuses an address that is not an email', () => {
    const parsed = clientInputSchema.safeParse(clientInputFromForm(form({ ...valid, email: 'soler' })))

    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error.issues[0]?.message).toBe('El correo no es válido.')
  })

  it('refuses a postal code that is not five digits, and accepts an empty one', () => {
    const wrong = clientInputSchema.safeParse(clientInputFromForm(form({ ...valid, postal_code: '432' })))
    expect(wrong.success).toBe(false)
    expect(!wrong.success && wrong.error.issues[0]?.message).toBe(
      'El código postal debe tener cinco cifras.',
    )

    const blank = clientInputSchema.safeParse(clientInputFromForm(form({ ...valid, postal_code: '' })))
    expect(blank.success && blank.data.postalCode).toBeNull()
  })
})
