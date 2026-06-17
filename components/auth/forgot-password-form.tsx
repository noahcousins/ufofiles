"use client"

import posthog from "posthog-js"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Turnstile } from "@/components/ui/turnstile"
import { authClient } from "@/lib/auth-client"
import { suggestEmailFix } from "@/lib/email-typo"

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/**
 * Dedicated password-reset request form (its own step in the auth dialog).
 * `requestPasswordReset` emails a link that lands on /reset-password; on success
 * we hand control back so the dialog shows the "check your email" screen.
 */
export function ForgotPasswordForm({
  email,
  onEmailChange,
  onSent,
  onBack,
}: {
  email: string
  onEmailChange: (value: string) => void
  onSent: () => void
  onBack: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Turnstile token + a key to force a fresh widget (tokens are single-use).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const emailSuggestion = suggestEmailFix(email)

  const resetCaptcha = () => {
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) {
      return
    }
    setError(null)
    setPending(true)
    // /request-password-reset is captcha-gated server-side; attach the token.
    const fetchOptions = captchaToken
      ? { headers: { "x-captcha-response": captchaToken } }
      : undefined
    const { error: err } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
      fetchOptions,
    })
    setPending(false)
    resetCaptcha()
    if (err) {
      setError(err.message ?? "Couldn't send the reset link. Try again.")
      return
    }
    posthog.capture("password_reset_requested")
    onSent()
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          className="h-9 text-sm"
          disabled={pending}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        {emailSuggestion && (
          <button
            className="-mt-0.5 self-start text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
            onClick={() => onEmailChange(emailSuggestion)}
            type="button"
          >
            Did you mean {emailSuggestion}?
          </button>
        )}
        {turnstileSiteKey && (
          <Turnstile
            key={captchaKey}
            onToken={setCaptchaToken}
            siteKey={turnstileSiteKey}
          />
        )}
        <Button
          className="w-full"
          disabled={pending || (Boolean(turnstileSiteKey) && !captchaToken)}
          size="lg"
          type="submit"
        >
          {pending ? <Spinner className="text-current" /> : "Send reset link"}
        </Button>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
      <button
        className="text-center text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
        onClick={onBack}
        type="button"
      >
        Back to sign in
      </button>
    </div>
  )
}
