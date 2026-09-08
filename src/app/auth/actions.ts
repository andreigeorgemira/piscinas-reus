'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/safe-next-path'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type SignInState = { error: string | null }

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  // The form carries `next` in a hidden field, but a Server Action is a POST
  // endpoint anyone can call directly, so the value is validated here rather
  // than trusted from the page that rendered it.
  const requested = safeNextPath(formData.get('next'))

  if (!email || !password) {
    return { error: 'Introduce tu correo y tu contraseña.' }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which addresses are registered.
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const landing = isAdmin ? '/admin' : '/portal'

  // A client can put ?next=/admin in the URL themselves. The route guard does
  // stop them - it serves the portal instead - but only after the browser has
  // committed to the /admin address, so the URL bar ends up lying about the
  // page on screen. Refuse the destination here as well. The prefix test
  // mirrors the guard's own in src/lib/supabase/middleware.ts.
  const destination =
    requested !== null && (isAdmin || !requested.startsWith('/admin'))
      ? requested
      : landing

  revalidatePath('/', 'layout')
  redirect(destination)
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
