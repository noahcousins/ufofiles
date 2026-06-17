"use client"

import posthog from "posthog-js"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { Turnstile } from "@/components/ui/turnstile"
import { authClient } from "@/lib/auth-client"

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/**
 * Email-verification code entry (shadcn OTP). The code was emailed by
 * `sendVerificationOnSignUp` (or Resend); verifying flips the account to a
 * Member. On success it calls `onVerified` — the caller decides what happens
 * next (refresh session, run a gated action, navigate).
 */
export function VerifyOtpForm({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Turnstile token gates the resend (an email send); a key remounts the
  // single-use widget after each resend. Verifying the code is not gated.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  const verify = async (code: string) => {
    if (pending) {
      return
    }
    setError(null)
    setPending(true)
    const { error: err } = await authClient.emailOtp.verifyEmail({
      email: email.trim(),
      otp: code.trim(),
    })
    setPending(false)
    if (err) {
      setError(err.message ?? "Invalid or expired code. Try again.")
      setOtp("")
      return
    }
    posthog.capture("email_verified")
    posthog.identify(email.trim(), { email: email.trim() })
    onVerified()
  }

  const handleResend = async () => {
    if (pending || (turnstileSiteKey && !captchaToken)) {
      return
    }
    setError(null)
    setOtp("")
    // /email-otp/send-verification-otp is captcha-gated server-side.
    const fetchOptions = captchaToken
      ? { headers: { "x-captcha-response": captchaToken } }
      : undefined
    await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "email-verification",
      fetchOptions,
    })
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }

  return (
    <form
      className="mt-5 flex flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        verify(otp)
      }}
    >
      <InputOTP
        disabled={pending}
        maxLength={6}
        onChange={setOtp}
        onComplete={verify}
        value={otp}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>

      <Button
        className="w-full"
        disabled={pending || otp.length < 6}
        size="lg"
        type="submit"
      >
        {pending ? <Spinner className="text-current" /> : "Verify email"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {turnstileSiteKey && (
        <Turnstile
          key={captchaKey}
          onToken={setCaptchaToken}
          siteKey={turnstileSiteKey}
        />
      )}
      <button
        className="text-center text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        disabled={Boolean(turnstileSiteKey) && !captchaToken}
        onClick={handleResend}
        type="button"
      >
        Resend code
      </button>
    </form>
  )
}
