import { describe, expect, it } from 'vitest'
import { detectDelimiter, parseCsv, parseImport } from './csv'

describe('detectDelimiter', () => {
  it('picks the semicolon when the header line contains one', () => {
    expect(detectDelimiter('concepto;unidad;coste;precio')).toBe(';')
  })

  it('picks the comma when no semicolon is present', () => {
    expect(detectDelimiter('concepto,unidad,coste,precio')).toBe(',')
  })

  it('prefers the semicolon when both delimiters appear in the header', () => {
    // No decimal can appear in a header, so any semicolon there is decisive --
    // a comma alongside it is just a column name that happens to contain one.
    expect(detectDelimiter('concepto;"unidad, embalaje";coste;precio')).toBe(';')
  })
})

describe('parseCsv', () => {
  it('splits plain rows on the delimiter', () => {
    expect(parseCsv('a,b,c\nd,e,f\n', ',')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ])
  })

  it('reads a quoted field literally, delimiter and all', () => {
    expect(parseCsv('a,"b,c",d\n', ',')).toEqual([['a', 'b,c', 'd']])
  })

  it('reads a doubled quote inside a quoted field as one literal quote', () => {
    expect(parseCsv('a,"b""c",d\n', ',')).toEqual([['a', 'b"c', 'd']])
  })

  it('reads a newline inside a quoted field as part of the field, not a row break', () => {
    expect(parseCsv('a,"b\nc",d\n', ',')).toEqual([['a', 'b\nc', 'd']])
  })

  it('treats CRLF as a single row ending', () => {
    expect(parseCsv('a,b\r\nc,d\r\n', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('does not turn a trailing blank line into an extra empty row', () => {
    expect(parseCsv('a,b\nc,d\n', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('reads the final row the same way whether or not the file ends with a newline', () => {
    expect(parseCsv('a,b\nc,d', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('splits on a semicolon delimiter, not a comma inside the field', () => {
    // Spanish Excel: ';' is the field separator because ',' is already the
    // decimal separator, so a real price cell like '1.234,56' must survive
    // untouched as one field when the delimiter is ';'.
    expect(parseCsv('Vaso;m2;1.234,56\n', ';')).toEqual([['Vaso', 'm2', '1.234,56']])
  })

  it('returns no rows at all for an empty string', () => {
    expect(parseCsv('', ',')).toEqual([])
  })

  it('treats a non-leading quote as literal text, not a field-opener', () => {
    // Pipe/fitting diameters are conventionally written with a bare inch
    // mark ('1", 2"'). A quote is only field-opening as the FIRST character
    // of a field -- one appearing after other characters is real content,
    // not RFC 4180 quoting, and must not flip the machine into quote mode
    // (which would otherwise swallow every delimiter and newline that
    // follows, until another '"' happens to turn up later in the file).
    expect(parseCsv('Tubo "1 PVC,m2,10,15\nOtro,m2,10,20\n', ',')).toEqual([
      ['Tubo "1 PVC', 'm2', '10', '15'],
      ['Otro', 'm2', '10', '20'],
    ])
  })

  it('does not let a mid-field quote merge the following row into the same cell', () => {
    // A second, deliberately-quoted field later in the file (the ',' inside
    // '20,00' needs escaping under a comma delimiter) must resync and parse
    // as its own row -- the earlier bare quote must not have left the
    // machine in quote mode by the time this row is reached.
    expect(
      parseCsv('Codo 1" PVC,m2,10,15\nValvula,unidad,"20,00",25\n', ','),
    ).toEqual([
      ['Codo 1" PVC', 'm2', '10', '15'],
      ['Valvula', 'unidad', '20,00', '25'],
    ])
  })

  it('terminates on an unterminated quote at EOF instead of losing everything before it', () => {
    // The opening quote here IS field-opening (it is the first character of
    // its field), so quote mode is entered legitimately and never closes.
    // The parser must still reach EOF and flush what it has, rather than
    // hanging or discarding the row that was already complete.
    expect(parseCsv('a,"b\n', ',')).toEqual([['a', 'b\n']])
  })
})

describe('parseImport', () => {
  it('parses a well-formed semicolon file exported from Spanish Excel', () => {
    const text = [
      'concepto;unidad;coste;precio;grupo;codigo;descripcion',
      'Vaso de gresite;m2;10,00;15,00;Revestimiento;REV-001;Revestimiento en gresite azul',
      'Mano de obra;hora;12,00;18,00;Mano de obra;;',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows).toEqual([
      {
        line: 2,
        groupName: 'Revestimiento',
        input: {
          groupId: null,
          code: 'REV-001',
          name: 'Vaso de gresite',
          description: 'Revestimiento en gresite azul',
          unit: 'm2',
          unitCost: 10,
          unitPrice: 15,
          isActive: true,
        },
      },
      {
        line: 3,
        groupName: 'Mano de obra',
        input: {
          groupId: null,
          code: null,
          name: 'Mano de obra',
          description: null,
          unit: 'hour',
          unitCost: 12,
          unitPrice: 18,
          isActive: true,
        },
      },
    ])
  })

  it('accepts English column names', () => {
    const text = ['name;unit;cost;price', 'Peon;hour;12,00;18,00'].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.input.name).toBe('Peon')
    expect(rows[0]?.input.unit).toBe('hour')
    expect(rows[0]?.input.unitCost).toBe(12)
    expect(rows[0]?.input.unitPrice).toBe(18)
  })

  it('maps the Spanish unit words staff actually type onto the enum', () => {
    const text = [
      'concepto;unidad;coste;precio',
      'A;hora;1,00;2,00',
      'B;ud.;1,00;2,00',
      'C;partida;1,00;2,00',
      'D;m²;1,00;2,00',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows.map((r) => r.input.unit)).toEqual(['hour', 'unit', 'lot', 'm2'])
  })

  it('reports a bad price by line number and keeps parsing the other rows', () => {
    const text = [
      'concepto;unidad;coste;precio',
      'Bueno;m2;10,00;15,00',
      'Malo;m2;10,00;no-es-un-precio',
      'OtroBueno;m2;10,00;20,00',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.input.name)).toEqual(['Bueno', 'OtroBueno'])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toBe(3)
    expect(issues[0]?.message).toContain('precio')
  })

  it('reports a missing required column instead of guessing what it meant', () => {
    const text = ['concepto;unidad;coste', 'A;m2;10,00'].join('\n')

    const { rows, issues } = parseImport(text)

    expect(rows).toEqual([])
    expect(issues).toEqual([{ line: 1, message: 'Falta la columna "precio".' }])
  })

  it('reports an empty file', () => {
    expect(parseImport('')).toEqual({
      rows: [],
      issues: [{ line: 1, message: 'El archivo está vacío.' }],
    })
    expect(parseImport('   \n  ')).toEqual({
      rows: [],
      issues: [{ line: 1, message: 'El archivo está vacío.' }],
    })
  })

  it('reports a duplicate code inside the file, naming both clashing lines', () => {
    const text = [
      'concepto;unidad;coste;precio;codigo',
      'A;m2;10,00;15,00;DUP',
      'B;m2;10,00;15,00;DUP',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.input.code).toBe('DUP')
    expect(issues).toHaveLength(1)
    expect(issues[0]?.line).toBe(3)
    expect(issues[0]?.message).toContain('DUP')
    expect(issues[0]?.message).toContain('línea 2')
  })

  it('ignores a blank line mid-file without losing the line count', () => {
    const text = [
      'concepto;unidad;coste;precio',
      'A;m2;10,00;15,00',
      '',
      'B;m2;10,00;20,00',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows.map((r) => [r.line, r.input.name])).toEqual([
      [2, 'A'],
      [4, 'B'],
    ])
  })

  it('keeps a following row intact when an earlier row has a non-leading quote in a cell', () => {
    const text = [
      'concepto;unidad;coste;precio',
      'Codo 1" PVC;m2;10,00;15,00',
      'Valvula;ud.;20,00;25,00',
    ].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ line: 2, input: { name: 'Codo 1" PVC' } })
    expect(rows[1]).toMatchObject({ line: 3, input: { name: 'Valvula', unit: 'unit' } })
  })

  it('strips a leading BOM from the header before matching columns', () => {
    const text = ['﻿concepto;unidad;coste;precio', 'A;m2;10,00;15,00'].join('\n')

    const { rows, issues } = parseImport(text)

    expect(issues).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.input.name).toBe('A')
  })
})
