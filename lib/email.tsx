import { render } from "@react-email/render"
import { Resend } from "resend"
import { ChangeEmailVerificationEmail } from "@/emails/change-email-verification"
import { MagicLinkEmail } from "@/emails/magic-link"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { VerificationCodeEmail } from "@/emails/verification-code"
import { VerifyEmail } from "@/emails/verify-email"

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM ?? "[ufo]files <onboarding@resend.dev>"

// Like the Redis-backed pieces of this app, email degrades gracefully: with no
// RESEND_API_KEY the send is logged instead of dispatched, so local dev and
// preview builds work without a Resend account.
const resend = apiKey ? new Resend(apiKey) : null

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
    html: await render(<MagicLinkEmail url={url} />),
  })
}

// Sent when a user requests a password reset. The `url` lands on the server
// reset endpoint, which validates the token and redirects to /reset-password.
export async function sendResetPasswordEmail(
  email: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Password reset for ${email}:\n${url}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Reset your [ufo]files password",
    html: await render(<ResetPasswordEmail url={url} />),
  })
}

// Sent on email/password sign-up. Verification is what turns a password account
// into a Member that can Export (ADR-0003) — magic-link and Google arrive
// already verified, so they never need this. We email a one-time code rather
// than a link so the user can finish verifying in the same tab/device.
export async function sendVerificationOtpEmail(
  email: string,
  code: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Verification code for ${email}: ${code}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Your [ufo]files verification code",
    html: await render(<VerificationCodeEmail code={code} />),
  })
}

// Link-based email verification. The OTP flow above handles sign-up
// verification; this link flow backs better-auth's `/verify-email` endpoint,
// which is what a change-email confirmation link resolves to.
export async function sendEmailVerificationEmail(
  email: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Verify-email link for ${email}:\n${url}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Verify your [ufo]files email",
    html: await render(<VerifyEmail url={url} />),
  })
}

// Sent to the user's *current* address when they request an email change, so a
// stolen session can't silently move an account to an attacker's inbox. The
// `url` confirms the change to `newEmail`. Goes to `currentEmail`, not the new
// one, on purpose.
export async function sendChangeEmailVerificationEmail(
  currentEmail: string,
  newEmail: string,
  url: string
): Promise<void> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY unset. Change-email confirm for ${currentEmail} → ${newEmail}:\n${url}`
    )
    return
  }

  await resend.emails.send({
    from,
    to: currentEmail,
    subject: "Confirm your new [ufo]files email",
    html: await render(
      <ChangeEmailVerificationEmail newEmail={newEmail} url={url} />
    ),
  })
}
