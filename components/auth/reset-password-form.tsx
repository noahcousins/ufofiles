"use client"

import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { AuthHeroImage } from "./auth-hero"

/**
 * Standalone page reached from the password-reset email link. better-auth
 * validates the token server-side and redirects here with `?token=…` (or
 * `?error=…` if it's expired/invalid). We finish by calling `resetPassword`.
 */
export function ResetPasswordForm({
  token,
  tokenError,
}: {
  token: string | null
  tokenError: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const invalid = tokenError || !token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending || !token) {
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setError(null)
    setPending(true)
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (err) {
      setError(err.message ?? "Couldn't reset your password. Try again.")
      return
    }
    posthog.capture("password_reset_completed")
    setDone(true)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-88 overflow-hidden border border-border bg-background shadow-2xl">
        <AuthHeroImage />
        <div className="px-6 pt-5 pb-6">
          {invalid && (
            <Outcome
              subtitle="This reset link is invalid or has expired."
              title="Link expired"
            >
              <Button
                className="w-full"
                onClick={() => router.push("/login?method=password")}
                size="lg"
              >
                Back to sign in
              </Button>
            </Outcome>
          )}

          {!invalid && done && (
            <Outcome
              subtitle="Sign in with your new password."
              title="Password reset"
            >
              <Button
                className="w-full"
                onClick={() => router.push("/login?method=password")}
                size="lg"
              >
                Continue to sign in
              </Button>
            </Outcome>
          )}

          {!(invalid || done) && (
            <>
              <h1 className="text-center font-semibold text-2xl tracking-tight">
                Choose a new password
              </h1>
              <form
                className="mt-5 flex flex-col gap-2"
                onSubmit={handleSubmit}
              >
                <Input
                  autoComplete="new-password"
                  className="h-9 text-sm"
                  disabled={pending}
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  required
                  type="password"
                  value={password}
                />
                <Input
                  autoComplete="new-password"
                  className="h-9 text-sm"
                  disabled={pending}
                  minLength={8}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  type="password"
                  value={confirm}
                />
                <Button
                  className="w-full"
                  disabled={pending}
                  size="lg"
                  type="submit"
                >
                  {pending ? (
                    <Spinner className="text-current" />
                  ) : (
                    "Reset password"
                  )}
                </Button>
                {error && <p className="text-destructive text-xs">{error}</p>}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Outcome({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        <p className="mt-1.5 text-balance text-muted-foreground text-sm leading-relaxed">
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  )
}
