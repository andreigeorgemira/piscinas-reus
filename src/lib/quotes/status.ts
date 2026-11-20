/**
 * The four states a quote lives in, and which moves between them exist.
 *
 * This mirrors set_quote_status in supabase/migrations/0013_quote_lifecycle.sql
 * and does not replace it. The database is where the rule is enforced -- it
 * runs the side effects each move carries and it refuses an illegal one even
 * when the POST arrives without any screen involved. This module exists so
 * the screen can decide what to OFFER, which is a different question: a
 * button that leads to a refusal is a bug the database cannot prevent.
 *
 * Keep the two in step. A move added here and not there fails at the click;
 * a move added there and not here is simply unreachable.
 */
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
}

/**
 * What each move is called on the button that performs it. The verb matters:
 * "Marcar como enviado" says the office is recording something it did, where
 * "Enviar" would promise an email this phase does not send (the PDF and the
 * public link are phases 4 and 5 of the spec).
 */
export const QUOTE_MOVE_LABELS: Record<QuoteStatus, string> = {
  draft: 'Volver a borrador',
  sent: 'Marcar como enviado',
  accepted: 'Marcar como aceptado',
  rejected: 'Marcar como rechazado',
}

const ALLOWED_MOVES: Record<QuoteStatus, readonly QuoteStatus[]> = {
  // Nothing can be accepted that was never sent: 'accepted' means a client
  // accepted something, and a draft has not left the office.
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'draft'],
  // Reopening is always available. It is how a mistake in a quote already out
  // is corrected, and how a client who changed their mind is served.
  accepted: ['draft'],
  rejected: ['draft'],
}

/** The moves to offer from a status, in the order the buttons read best. */
export function movesFrom(status: QuoteStatus): readonly QuoteStatus[] {
  return ALLOWED_MOVES[status]
}

/** Whether one status can become another. Asking for the same one is not a move. */
export function canMove(from: QuoteStatus, to: QuoteStatus): boolean {
  return ALLOWED_MOVES[from].includes(to)
}

/**
 * Whether the lines of a quote in this status can still be edited.
 *
 * The real answer is a trigger: quote_items_guard_status
 * (supabase/migrations/0009_quote_immutability.sql) refuses every write to a
 * line whose quote has left 'draft'. The screen asks this so it can render
 * read-only rows instead of inputs that would be refused on save.
 */
export function isEditable(status: QuoteStatus): boolean {
  return status === 'draft'
}

/** Why a non-draft quote shows no edit controls, in the words the screen uses. */
export function frozenReason(status: QuoteStatus): string {
  return `Este presupuesto está ${QUOTE_STATUS_LABELS[status].toLowerCase()} y sus líneas están congeladas. Vuelve a borrador para editarlo.`
}
