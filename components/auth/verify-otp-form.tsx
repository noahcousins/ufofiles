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
import { authClient } from "@/lib/auth-client"

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
    if (pending) {
      return
    }
    setError(null)
    setOtp("")
    await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "email-verification",
    })
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
      <button
        className="text-center text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
        onClick={handleResend}
        type="button"
      >
        Resend code
      </button>
    </form>
  )
}
