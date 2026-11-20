/**
 * Sending email, through Resend's HTTP API and nothing else.
 *
 * No SDK: the API is one POST with a JSON body, and a dependency that wraps it
 * would be a dependency to keep current for no gain. Errors come back as a
 * sentence rather than thrown, because every caller is a Server Action whose job
 * is to put that sentence on a screen.
 *
 * When RESEND_API_KEY is missing the send is SKIPPED, not faked: the caller is
 * told so and says it out loud. That is what lets the local review server, the
 * e2e suite and a fresh checkout exercise the whole flow -- link, status,
 * document -- without a key and without anybody's inbox, and without a screen
 * that claims an email went out when none did.
 */
export type SendResult =
  | { ok: true; skipped: false; id: string | null }
  | { ok: true; skipped: true; id: null }
  | { ok: false; skipped: false; error: string }

export type Email = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()

  if (!key || !from) {
    console.info('email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL is not set', {
      to: email.to,
      subject: email.subject,
    })
    return { ok: true, skipped: true, id: null }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('resend refused the message', response.status, detail)
      return {
        ok: false,
        skipped: false,
        error:
          response.status === 422
            ? 'El correo del cliente no parece válido para el servidor de envío.'
            : 'El servidor de correo rechazó el envío. Inténtalo de nuevo en un momento.',
      }
    }

    const body = (await response.json()) as { id?: string }
    return { ok: true, skipped: false, id: body.id ?? null }
  } catch (error) {
    console.error('could not reach the email service', error)
    return {
      ok: false,
      skipped: false,
      error: 'No se pudo conectar con el servidor de correo.',
    }
  }
}
