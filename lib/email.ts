import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM ?? "[ufo]files <onboarding@resend.dev>"

// Like the Redis-backed pieces of this app, email degrades gracefully: with no
// RESEND_API_KEY the send is logged instead of dispatched, so local dev and
// preview builds work without a Resend account.
const resend = apiKey ? new Resend(apiKey) : null

function emailButton(url: string, label: string): string {
  return `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">${label}</h2>
      <p style="margin: 0 0 20px; color: #444;">
        Click the button below. This link expires shortly and can be used once.
      </p>
      <a href="${url}"
         style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        ${label}
      </a>
      <p style="margin: 24px 0 0; color: #888; font-size: 13px;">
        If you didn't request this, you can ignore this email.
      </p>
    </div>
  `
}

export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Magic link for ${email}:\n${url}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Your [ufo]files sign-in link",
    html: emailButton(url, "Sign in to [ufo]files"),
  })
}

// Sent on email/password sign-up. Verification is what turns a password account
// into a Member that can Export (ADR-0003) — magic-link and Google arrive
// already verified, so they never need this.
export async function sendVerificationEmail(
  email: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Verify link for ${email}:\n${url}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Verify your [ufo]files email",
    html: emailButton(url, "Verify your email"),
  })
}
