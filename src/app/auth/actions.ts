'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminPath, isLoginPath } from '@/lib/routes'
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

  // Two destinations are same-site and still wrong, so safeNextPath - which
  // only answers "is this the same site" - lets both through and they are
  // refused here instead.
  //
  // /admin for a non-admin: the route guard does stop them, it serves the
  // portal, but only after the browser has committed to the /admin address, so
  // the URL bar ends up naming a page they are not being shown. isAdminPath
  // normalises first, because `'/./admin'.startsWith('/admin')` is false and a
  // browser sent there lands on /admin all the same.
  //
  // /login for anyone: an empty credential form rendered straight after a
  // successful sign-in is a link worth handing out - it farms a second
  // password entry from someone with every reason to think the first failed.
  const usable =
    requested !== null &&
    !isLoginPath(requested) &&
    (isAdmin || !isAdminPath(requested))

  revalidatePath('/', 'layout')
  redirect(usable ? requested : landing)
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
