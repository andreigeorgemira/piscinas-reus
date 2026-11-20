'use server'

import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/app/admin/action-state'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  companySettingsFromForm,
  companySettingsSchema,
  companySettingsToRow,
  fieldIssues,
  firstIssue,
} from '@/lib/settings/schema'

export type { ActionState }

/**
 * Saves the company settings: the letterhead every quote prints and the VAT a
 * new quote starts with.
 *
 * What it never does is touch a quote. Each quote keeps the VAT rate it was
 * written with (0019), and the letterhead is read when a document is drawn, so
 * a quote sent last month prints the company's details as they are today but
 * charges the VAT it was sent with.
 */
export async function updateCompanySettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireAdmin()

  const parsed = companySettingsSchema.safeParse(companySettingsFromForm(formData))
  if (!parsed.success) {
    return { error: firstIssue(parsed.error), fields: fieldIssues(parsed.error) }
  }

  const { error } = await supabase
    .from('company_settings')
    .update(companySettingsToRow(parsed.data))
    .eq('id', true)

  if (error) {
    console.error('company settings write failed', error)
    return {
      error:
        error.code === '42501'
          ? 'No tienes permiso para cambiar los ajustes.'
          : 'No se pudieron guardar los ajustes. Inténtalo de nuevo.',
    }
  }

  revalidatePath('/admin/settings')
  // The quote screens offer the VAT default and print the letterhead.
  revalidatePath('/admin/quotes', 'layout')
  return { error: null }
}
