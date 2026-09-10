import type { ImportIssue } from '@/lib/price-book/csv'
import type { UnitType } from '@/lib/price-book/schema'

/**
 * One parsed row, as the preview table shows it. `action` is decided against
 * the database at preview time only -- commitImport re-derives everything
 * from the text itself rather than trusting this.
 */
export type PreviewRow = {
  line: number
  groupName: string | null
  code: string | null
  name: string
  unit: UnitType
  unitCost: number
  unitPrice: number
  action: 'create' | 'update'
}

/**
 * What the import screen's two Server Actions return, and the value the
 * form starts from.
 *
 * This lives beside actions.ts rather than inside it because a 'use server'
 * module may only export async functions -- see action-state.ts one level up
 * for the full explanation of why a plain object here would break the
 * module.
 */
export type ImportState = {
  stage: 'idle' | 'preview' | 'done'
  /** The raw text last previewed (or pasted). Carried in a hidden field so
   *  nothing is held server-side between the preview and the commit. */
  text: string
  rows: PreviewRow[]
  issues: ImportIssue[]
  /** Codeless rows written. These are always inserts, so this count is exact. */
  created: number
  /** Coded rows written. An upsert does not report which half of the work it
   *  did, so this counts every row that carried a code -- some may have been
   *  new, some may have replaced an existing one. The screen must word this
   *  as "created or updated", never as a precise update count. */
  updated: number
  groupsCreated: number
  error: string | null
}

export const idleImportState: ImportState = {
  stage: 'idle',
  text: '',
  rows: [],
  issues: [],
  created: 0,
  updated: 0,
  groupsCreated: 0,
  error: null,
}
