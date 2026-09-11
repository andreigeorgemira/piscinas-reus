'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { ProfileState } from './profile-state'

// Re-exported so callers read the contract off this module. Only the type: a
// value re-export would be a runtime export of a 'use server' file.
export type { ProfileState }

const profileSchema = z.object({
  // Optional because a profile row exists from the moment the account does,
  // long before anyone has filled it in. An empty field clears the column
  // rather than storing an empty string, so "not set" has one spelling.
  full_name: z.string().trim().max(120, 'El nombre no puede pasar de 120 caracteres.'),
  phone: z.string().trim().max(40, 'El teléfono no puede pasar de 40 caracteres.'),
})

/**
 * Updates the signed-in user's own name and phone.
 *
 * Scoped with `.eq('id', user.id)` and not by trusting a posted id: this is
 * a POST endpoint anyone signed in can call, and the admin RLS policy
 * (supabase/migrations/0003_rls_policies.sql, profiles_admin_all) lets an
 * admin write ANY profile. The filter is what keeps this action about the
 * caller's own row.
 */
export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await requireAdmin()

  const parsed = profileSchema.safeParse({
    full_name: String(formData.get('full_name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.', saved: false }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'La sesión ha caducado. Vuelve a entrar.', saved: false }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name === '' ? null : parsed.data.full_name,
      phone: parsed.data.phone === '' ? null : parsed.data.phone,
    })
    .eq('id', user.id)

  if (error) {
    console.error('profile update failed', error)
    return { error: 'No se pudo guardar el perfil. Inténtalo de nuevo.', saved: false }
  }

  revalidatePath('/admin', 'layout')
  return { error: null, saved: true }
}
