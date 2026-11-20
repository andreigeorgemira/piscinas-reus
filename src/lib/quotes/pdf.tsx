/* eslint-disable jsx-a11y/alt-text -- @react-pdf's <Image> is a PDF primitive
   with no alt prop: it renders into a document, not into a DOM, and the rule is
   matching on the element's name alone. */
import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'
import { roundMoney } from '@/lib/money'
import { formatEuros, formatPercent } from '@/lib/price-book/decimal'
import { UNIT_LABELS } from '@/lib/price-book/schema'
import { plural } from '@/lib/plural'
import { letterheadLines, type Letterhead } from '@/lib/settings/letterhead'
import { formatVatRate } from '@/lib/vat'
import { documentSections, presentationOrder, type GroupDisplay } from './presentation'
import { formatQuantity } from './quantity'
import { formatSpanishDate, type PublicQuote, UNGROUPED_SECTION } from './public'
import { isPngDataUrl } from './signature'
import type { QuoteDetail } from './queries'
import { lineTotal } from './totals'

/**
 * The quote as a PDF: the document that gets emailed, printed and filed.
 *
 * Built from a shape of its own rather than from either of the two quote types
 * already in the codebase, because both can produce it and neither should own
 * it: the public page has a client-safe quote read through a token, the admin
 * has the full row, and the office must be able to print a draft that has no
 * public link yet. `fromPublicQuote` and `fromQuoteDetail` are the two adapters,
 * and both produce the SAME document: what the office prints is what the client
 * downloads, hidden prices included.
 *
 * Cost and margin have no field here at all. That is not an omission to
 * remember -- there is nowhere to put them.
 */
export type QuoteDocumentLine = {
  name: string
  description: string | null
  quantity: number
  unit: keyof typeof UNIT_LABELS
  /** Null in a group that is not shown in detail. */
  unitPrice: number | null
  discountPct: number | null
  lineTotal: number | null
}

export type QuoteDocumentGroup = {
  name: string
  display: GroupDisplay
  items: QuoteDocumentLine[]
  subtotal: number
}

export type QuoteDocumentExtra = {
  name: string
  description: string | null
  quantity: number
  unit: keyof typeof UNIT_LABELS
  unitPrice: number
  discountPct: number
  lineTotal: number
  selected: boolean
}

export type QuoteDocumentData = {
  reference: string
  title: string
  company: Letterhead
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
  groups: QuoteDocumentGroup[]
  extras: QuoteDocumentExtra[]
  baseTotal: number
  selectedExtrasTotal: number
  grandTotal: number
  /** Null: the document carries no VAT and says so. */
  vatRate: number | null
  vatTotal: number
  totalWithVat: number
  /** Only for an accepted quote: anything else has not been signed. */
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
  discount: { fontSize: 7, color: '#a16207', marginTop: 1 },
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
  // A drawn box rather than a ☑/☐ glyph: Helvetica, the only font a PDF can
  // count on, has neither, and they printed as blanks -- the client's choice
  // was simply not on the document.
  checkbox: {
    width: 8,
    height: 8,
    borderWidth: 0.8,
    borderColor: MUTED,
    borderRadius: 1.5,
    marginRight: 6,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { borderColor: ACCENT, backgroundColor: ACCENT },
  checkMark: { width: 4, height: 4, backgroundColor: '#ffffff', borderRadius: 0.5 },
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
  vatLine: { fontSize: 8, color: '#d1d5db', textAlign: 'right', lineHeight: 1.6 },
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

function quantityText(line: { quantity: number; unit: keyof typeof UNIT_LABELS }): string {
  return `${formatQuantity(line.quantity)} ${UNIT_LABELS[line.unit]}`
}

/** A line with every figure: quantity, price (and its discount) and amount. */
function DetailedLine({ line }: { line: QuoteDocumentLine }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.cellName}>
        <Text>{line.name}</Text>
        {line.description ? <Text style={styles.description}>{line.description}</Text> : null}
      </View>
      <Text style={styles.cellNumber}>{quantityText(line)}</Text>
      <View style={{ width: 62 }}>
        <Text style={{ textAlign: 'right', color: MUTED }}>
          {line.unitPrice === null ? '' : formatEuros(line.unitPrice)}
        </Text>
        {line.discountPct ? (
          <Text style={[styles.discount, { textAlign: 'right' }]}>{`dto. ${formatPercent(line.discountPct)}`}</Text>
        ) : null}
      </View>
      <Text style={styles.cellAmount}>{line.lineTotal === null ? '' : formatEuros(line.lineTotal)}</Text>
    </View>
  )
}

/** A line of a group shown without prices: what it is and how much of it. */
function UnpricedLine({ line }: { line: QuoteDocumentLine }) {
  return (
    <View style={styles.row} wrap={false}>
      <View style={styles.cellName}>
        <Text>{line.name}</Text>
        {line.description ? <Text style={styles.description}>{line.description}</Text> : null}
      </View>
      <Text style={styles.cellNumber}>{quantityText(line)}</Text>
    </View>
  )
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <View style={on ? [styles.checkbox, styles.checkboxOn] : styles.checkbox}>
      {on ? <View style={styles.checkMark} /> : null}
    </View>
  )
}

/** The PDF itself. Same order, the same groups and the same hidden prices as the screen. */
export function QuoteDocument({ quote }: { quote: QuoteDocumentData }) {
  const chosenExtras = quote.extras.filter((extra) => extra.selected)
  const withVat = quote.vatRate !== null
  const footer = [quote.company.tradeName, quote.company.quoteFooter].filter(Boolean).join(' · ')

  return (
    <Document
      title={`Presupuesto ${quote.reference}`}
      author={quote.company.tradeName}
      subject={quote.title}
    >
      <Page size="A4" style={styles.page}>
        {quote.draft ? (
          <Text style={styles.draftBand}>
            BORRADOR · este presupuesto todavía no se ha enviado al cliente
          </Text>
        ) : null}

        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.brand}>{quote.company.tradeName}</Text>
            <Text style={styles.brandLine}>{letterheadLines(quote.company).join('\n')}</Text>
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
            {group.display === 'detailed'
              ? group.items.map((item, index) => <DetailedLine key={`${group.name}-${index}`} line={item} />)
              : null}
            {group.display === 'no_prices'
              ? group.items.map((item, index) => <UnpricedLine key={`${group.name}-${index}`} line={item} />)
              : null}
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
                <View style={[styles.cellName, { flexDirection: 'row' }]}>
                  <Checkbox on={extra.selected} />
                  <Text>{extra.name}</Text>
                </View>
                <Text style={styles.cellNumber}>{quantityText(extra)}</Text>
                <View style={{ width: 62 }}>
                  <Text style={{ textAlign: 'right', color: MUTED }}>{formatEuros(extra.unitPrice)}</Text>
                  {extra.discountPct ? (
                    <Text style={[styles.discount, { textAlign: 'right' }]}>
                      {`dto. ${formatPercent(extra.discountPct)}`}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cellAmount}>{formatEuros(extra.lineTotal)}</Text>
              </View>
            ))}
            {chosenExtras.length > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                <Text style={{ color: MUTED }}>{plural(chosenExtras.length, 'extra marcado', 'extras marcados')}</Text>
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
            <Text style={styles.grandValue}>
              {formatEuros(withVat ? quote.totalWithVat : quote.grandTotal)}
            </Text>
          </View>
          {withVat ? (
            <Text style={styles.vatLine}>
              {`Base imponible ${formatEuros(quote.grandTotal)}\nIVA ${formatVatRate(quote.vatRate!)} ${formatEuros(quote.vatTotal)}`}
            </Text>
          ) : (
            <Text style={{ fontSize: 7, color: '#9aa1ab' }}>IVA no incluido</Text>
          )}
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
          {footer}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * The signature block, or null.
 *
 * Only an accepted quote has been signed. The columns can only hold a name for
 * an accepted quote since 0016 cleared them on reopening, but the document
 * checks the status too: a block that says "Presupuesto aceptado" must never
 * depend on a column being tidy.
 */
function signatureOf(
  status: string,
  name: string | null,
  at: string | null,
  image: string | null,
): QuoteDocumentData['signature'] {
  if (status !== 'accepted' || !name) return null
  // A stored value that is not really a PNG would hang the renderer rather
  // than fail it; the document goes out without the drawing.
  return { name, at, image: isPngDataUrl(image) ? image : null }
}

/** The document a client's link prints. */
export function fromPublicQuote(quote: PublicQuote, signatureImage: string | null = null): QuoteDocumentData {
  return {
    reference: quote.reference,
    title: quote.title,
    company: quote.company,
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
      display: group.display,
      subtotal: group.subtotal,
      items: group.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discountPct: item.discountPct,
        lineTotal: item.lineTotal,
      })),
    })),
    extras: quote.extras.map((extra) => ({
      name: extra.name,
      description: extra.description,
      quantity: extra.quantity,
      unit: extra.unit,
      unitPrice: extra.unitPrice,
      discountPct: extra.discountPct,
      lineTotal: extra.lineTotal,
      selected: extra.clientSelected,
    })),
    baseTotal: quote.totals.baseTotal,
    selectedExtrasTotal: quote.totals.selectedExtrasTotal,
    grandTotal: quote.totals.grandTotal,
    vatRate: quote.totals.vatRate,
    vatTotal: quote.totals.vatTotal,
    totalWithVat: quote.totals.totalWithVat,
    signature: signatureOf(quote.status, quote.signedName, quote.signedAt, signatureImage),
    draft: false,
  }
}

/**
 * The document the office prints, including for a draft.
 *
 * The lines arrive in `position` order, which the editor keeps in the order the
 * document prints (groups as staff placed them, see presentation.ts). Prices of
 * a group that is not detailed are dropped here exactly as quote_by_token drops
 * them for the client, so the office's copy and the client's are one document.
 */
export function fromQuoteDetail(
  quote: QuoteDetail,
  company: Letterhead,
  signatureImage: string | null = null,
): QuoteDocumentData {
  const ordered = [...quote.items].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  )

  // Ordered by the presentation itself, not only by `position`: the document
  // must not depend on the renumbering having run (it is best-effort).
  const groups: QuoteDocumentGroup[] = documentSections(presentationOrder(ordered, quote.groups), quote.groups).map((section) => {
    const shown = section.display === 'detailed'
    return {
      name: section.groupName ?? UNGROUPED_SECTION,
      display: section.display,
      subtotal: roundMoney(section.lines.reduce((sum, line) => sum + lineTotal(line), 0)),
      items: section.lines.map((line) => ({
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: shown ? line.unitPrice : null,
        discountPct: shown ? line.discountPct : null,
        lineTotal: shown ? lineTotal(line) : null,
      })),
    }
  })

  return {
    reference: quote.reference,
    title: quote.title,
    company,
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
        discountPct: item.discountPct,
        lineTotal: lineTotal(item),
        selected: item.clientSelected,
      })),
    baseTotal: quote.totals.baseTotal,
    selectedExtrasTotal: quote.totals.selectedExtrasTotal,
    grandTotal: quote.totals.grandTotal,
    vatRate: quote.totals.vatRate,
    vatTotal: quote.totals.vatTotal,
    totalWithVat: quote.totals.totalWithVat,
    signature: signatureOf(quote.status, quote.signedName, quote.signedAt, signatureImage),
    draft: quote.status === 'draft',
  }
}
