/* eslint-disable jsx-a11y/alt-text -- @react-pdf's <Image> is a PDF primitive
   with no alt prop: it renders into a document, not into a DOM, and the rule is
   matching on the element's name alone. */
import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'
import { formatEuros } from '@/lib/price-book/decimal'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { formatQuantity } from './quantity'
import { formatSpanishDate, type PublicQuote, UNGROUPED_SECTION } from './public'
import { isPngDataUrl } from './signature'
import type { QuoteDetail } from './queries'

/**
 * The quote as a PDF: the document that gets emailed, printed and filed.
 *
 * Built from a shape of its own rather than from either of the two quote types
 * already in the codebase, because both can produce it and neither should own
 * it: the public page has a client-safe quote read through a token, the admin
 * has the full row, and the office must be able to print a draft that has no
 * public link yet. `fromPublicQuote` and `fromQuoteDetail` are the two adapters.
 *
 * Cost and margin have no field here at all. That is not an omission to
 * remember -- there is nowhere to put them.
 */
export type QuoteDocumentLine = {
  name: string
  description: string | null
  quantity: number
  unit: keyof typeof UNIT_LABELS
  unitPrice: number
  lineTotal: number
}

export type QuoteDocumentData = {
  reference: string
  title: string
  /** The day the quote left the office, or today for one that has not. */
  issuedOn: string | null
  validUntil: string | null
  startDatePlanned: string | null
  clientNotes: string | null
  client: {
    fullName: string
    address: string | null
    city: string | null
    postalCode: string | null
  } | null
  groups: { name: string; items: QuoteDocumentLine[]; subtotal: number }[]
  extras: (QuoteDocumentLine & { selected: boolean })[]
  baseTotal: number
  selectedExtrasTotal: number
  grandTotal: number
  signature: { name: string; at: string | null; image: string | null } | null
  /** True for a quote that has not been sent: the page says so across the top. */
  draft: boolean
}

const INK = '#16181d'
const MUTED = '#6b7280'
const FAINT = '#9aa1ab'
const LINE = '#e3e6ea'
const ACCENT = '#2563eb'

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 56, paddingHorizontal: 46, fontSize: 9, color: INK },
  draftBand: {
    marginBottom: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fef7e6',
    borderWidth: 1,
    borderColor: '#f0d9a8',
    borderRadius: 4,
    color: '#a16207',
    fontSize: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 12,
  },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  brandLine: { fontSize: 8, color: MUTED, marginTop: 4, lineHeight: 1.5 },
  label: { fontSize: 7, color: FAINT, letterSpacing: 1, textTransform: 'uppercase' },
  reference: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  parties: { flexDirection: 'row', gap: 28, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: LINE },
  party: { flex: 1 },
  partyName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  partyLine: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginTop: 14,
  },
  groupName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eef0f3',
  },
  cellName: { flex: 1, paddingRight: 8 },
  cellNumber: { width: 62, textAlign: 'right', color: MUTED },
  cellAmount: { width: 62, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  description: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: INK,
    marginTop: 10,
    paddingTop: 7,
  },
  extrasBox: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bfd0f5',
    borderRadius: 4,
    backgroundColor: '#f8fafe',
  },
  grandBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: INK,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  grandLabel: { fontSize: 7, color: '#9aa1ab', letterSpacing: 1, textTransform: 'uppercase' },
  grandValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 2 },
  notes: { marginTop: 16, fontSize: 8, color: '#3d424b', lineHeight: 1.5 },
  signatureBox: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 4,
    backgroundColor: '#ecfdf5',
  },
  signatureImage: { width: 180, height: 60, marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 26,
    left: 46,
    right: 46,
    fontSize: 7,
    color: FAINT,
    textAlign: 'center',
  },
})

function Line({ line }: { line: QuoteDocumentLine }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.cellName}>
        <Text>{line.name}</Text>
        {line.description ? <Text style={styles.description}>{line.description}</Text> : null}
      </View>
      <Text style={styles.cellNumber}>
        {`${formatQuantity(line.quantity)} ${UNIT_LABELS[line.unit]}`}
      </Text>
      <Text style={styles.cellNumber}>{formatEuros(line.unitPrice)}</Text>
      <Text style={styles.cellAmount}>{formatEuros(line.lineTotal)}</Text>
    </View>
  )
}

/** The PDF itself. Same order and the same groups as the screen. */
export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  const chosenExtras = quote.extras.filter((extra) => extra.selected)

  return (
    <Document
      title={`Presupuesto ${quote.reference}`}
      author="Piscinas Reus"
      subject={quote.title}
    >
      <Page size="A4" style={styles.page}>
        {quote.draft ? (
          <Text style={styles.draftBand}>
            BORRADOR · este presupuesto todavía no se ha enviado al cliente
          </Text>
        ) : null}

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Piscinas Reus</Text>
            <Text style={styles.brandLine}>
              Construcción y mantenimiento de piscinas{'\n'}Reus, Tarragona
            </Text>
          </View>
          <View>
            <Text style={[styles.label, { textAlign: 'right' }]}>Presupuesto</Text>
            <Text style={[styles.reference, { textAlign: 'right' }]}>{quote.reference}</Text>
            <Text style={[styles.brandLine, { textAlign: 'right' }]}>
              {formatSpanishDate(quote.issuedOn)}
              {quote.validUntil ? `\nVálido hasta el ${formatSpanishDate(quote.validUntil)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          {quote.client ? (
            <View style={styles.party}>
              <Text style={styles.label}>Para</Text>
              <Text style={styles.partyName}>{quote.client.fullName}</Text>
              {quote.client.address ? (
                <Text style={styles.partyLine}>
                  {quote.client.address}
                  {'\n'}
                  {`${quote.client.postalCode ?? ''} ${quote.client.city ?? ''}`.trim()}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.party}>
            <Text style={styles.label}>Trabajo</Text>
            <Text style={styles.partyName}>{quote.title}</Text>
            {quote.startDatePlanned ? (
              <Text style={styles.partyLine}>
                {`Inicio previsto: ${formatSpanishDate(quote.startDatePlanned)}`}
              </Text>
            ) : null}
          </View>
        </View>

        {quote.groups.map((group) => (
          <View key={group.name}>
            <View style={styles.groupHead} wrap={false}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatEuros(group.subtotal)}</Text>
            </View>
            {group.items.map((item, index) => (
              <Line key={`${group.name}-${index}`} line={item} />
            ))}
          </View>
        ))}

        <View style={styles.totalRow} wrap={false}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Suma de los trabajos</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatEuros(quote.baseTotal)}</Text>
        </View>

        {quote.extras.length > 0 ? (
          <View style={styles.extrasBox} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: ACCENT }}>Extras opcionales</Text>
            <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 2, marginBottom: 4 }}>
              Fuera del total salvo los que estén marcados.
            </Text>
            {quote.extras.map((extra, index) => (
              <View key={`extra-${index}`} style={styles.row} wrap={false}>
                <View style={styles.cellName}>
                  <Text>{`${extra.selected ? '☑' : '☐'}  ${extra.name}`}</Text>
                </View>
                <Text style={styles.cellNumber}>
                  {`${formatQuantity(extra.quantity)} ${UNIT_LABELS[extra.unit]}`}
                </Text>
                <Text style={styles.cellNumber}>{formatEuros(extra.unitPrice)}</Text>
                <Text style={styles.cellAmount}>{formatEuros(extra.lineTotal)}</Text>
              </View>
            ))}
            {chosenExtras.length > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                <Text style={{ color: MUTED }}>
                  {chosenExtras.length === 1 ? '1 extra marcado' : `${chosenExtras.length} extras marcados`}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: ACCENT }}>
                  {formatEuros(quote.selectedExtrasTotal)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.grandBox} wrap={false}>
          <View>
            <Text style={styles.grandLabel}>
              {quote.extras.length > 0 ? 'Total con los extras marcados' : 'Total'}
            </Text>
            <Text style={styles.grandValue}>{formatEuros(quote.grandTotal)}</Text>
          </View>
          <Text style={{ fontSize: 7, color: '#9aa1ab' }}>IVA no incluido</Text>
        </View>

        {quote.clientNotes ? (
          <View style={styles.notes}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Condiciones</Text>
            <Text>{quote.clientNotes}</Text>
          </View>
        ) : null}

        {quote.signature ? (
          <View style={styles.signatureBox} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#15803d' }}>
              Presupuesto aceptado
            </Text>
            <Text style={{ fontSize: 8, color: '#3d424b', marginTop: 2 }}>
              {`Firmado por ${quote.signature.name}${
                quote.signature.at ? ` el ${formatSpanishDate(quote.signature.at.slice(0, 10))}` : ''
              }.`}
            </Text>
            {quote.signature.image ? (
              <Image style={styles.signatureImage} src={quote.signature.image} />
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Piscinas Reus · Las cantidades pueden ajustarse tras el replanteo en obra; cualquier
          cambio se comunica antes de ejecutarlo.
        </Text>
      </Page>
    </Document>
  )
}

/** The document a client's link prints. */
export function fromPublicQuote(quote: PublicQuote): QuoteDocumentData {
  return {
    reference: quote.reference,
    title: quote.title,
    issuedOn: quote.sentAt?.slice(0, 10) ?? null,
    validUntil: quote.validUntil,
    startDatePlanned: quote.startDatePlanned,
    clientNotes: quote.clientNotes,
    client: quote.client
      ? {
          fullName: quote.client.fullName,
          address: quote.client.address,
          city: quote.client.city,
          postalCode: quote.client.postalCode,
        }
      : null,
    groups: quote.groups.map((group) => ({
      name: group.name,
      subtotal: group.subtotal,
      items: group.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    })),
    extras: quote.extras.map((extra) => ({
      name: extra.name,
      description: extra.description,
      quantity: extra.quantity,
      unit: extra.unit,
      unitPrice: extra.unitPrice,
      lineTotal: extra.lineTotal,
      selected: extra.clientSelected,
    })),
    baseTotal: quote.totals.baseTotal,
    selectedExtrasTotal: quote.totals.selectedExtrasTotal,
    grandTotal: quote.totals.grandTotal,
    signature: quote.signedName
      ? { name: quote.signedName, at: quote.signedAt, image: null }
      : null,
    draft: false,
  }
}

/**
 * The document the office prints, including for a draft.
 *
 * It groups the lines here rather than reusing the board: the PDF's order is
 * `position`, which the editor keeps in step with the catalogue, so walking the
 * lines in order and starting a section whenever the group name changes gives
 * the same document without knowing anything about price books.
 */
export function fromQuoteDetail(
  quote: QuoteDetail,
  signature: { name: string | null; at: string | null; image: string | null } | null = null,
): QuoteDocumentData {
  const ordered = [...quote.items].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  )

  const groups: QuoteDocumentData['groups'] = []
  for (const item of ordered) {
    if (item.isRecommended) continue
    const name = item.groupName ?? UNGROUPED_SECTION
    const line: QuoteDocumentLine = {
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: Math.round(item.quantity * item.unitPrice * (1 - item.discountPct / 100) * 100) / 100,
    }
    const section = groups.find((group) => group.name === name)
    if (section) {
      section.items.push(line)
      section.subtotal += line.lineTotal
      continue
    }
    groups.push({ name, items: [line], subtotal: line.lineTotal })
  }

  return {
    reference: quote.reference,
    title: quote.title,
    issuedOn: quote.sentAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    validUntil: quote.validUntil,
    startDatePlanned: quote.startDatePlanned,
    clientNotes: quote.clientNotes,
    client: quote.client
      ? {
          fullName: quote.client.fullName,
          address: quote.client.address,
          city: quote.client.city,
          postalCode: quote.client.postalCode,
        }
      : null,
    groups,
    extras: ordered
      .filter((item) => item.isRecommended)
      .map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal:
          Math.round(item.quantity * item.unitPrice * (1 - item.discountPct / 100) * 100) / 100,
        selected: item.clientSelected,
      })),
    baseTotal: quote.totals.baseTotal,
    selectedExtrasTotal: quote.totals.selectedExtrasTotal,
    grandTotal: quote.totals.grandTotal,
    signature: signature?.name
      ? {
          name: signature.name,
          at: signature.at,
          // A stored value that is not really a PNG would hang the renderer
          // rather than fail it; the document goes out without the drawing.
          image: isPngDataUrl(signature.image) ? signature.image : null,
        }
      : null,
    draft: quote.status === 'draft',
  }
}
