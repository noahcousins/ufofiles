"use client"

import { GoogleLogoIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import posthog from "posthog-js"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Turnstile } from "@/components/ui/turnstile"
import { signIn, signUp } from "@/lib/auth-client"
import { suggestEmailFix } from "@/lib/email-typo"
import { trpc } from "@/lib/trpc/client"
import { Divider } from "./auth-parts"
import type { AuthMode } from "./auth-types"
import { JUST_AUTHED_KEY } from "./email-verification-provider"

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

// `?method` is URL-driven (nuqs) so flows can deep-link straight to the password
// form — e.g. after a password reset, "Continue to sign in" → `?method=password`
// instead of the default magic-link. Clears from the URL on the default.
const methodParser = parseAsStringLiteral(["magic", "password"] as const)

interface CredentialsFormProps {
  callbackURL: string
  email: string
  mode: AuthMode
  onEmailChange: (value: string) => void
  onForgot: () => void
  onMagicSent: () => void
}

export function CredentialsForm({
  callbackURL,
  email,
  mode,
  onEmailChange,
  onForgot,
  onMagicSent,
}: CredentialsFormProps) {
  const [method, setMethod] = useQueryState(
    "method",
    methodParser.withDefault("magic")
  )
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Turnstile token + a key to force a fresh widget (tokens are single-use, so
  // we remount the widget after every submit).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  const config = trpc.me.config.useQuery()

  const resetCaptcha = () => {
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }

  const handleGoogle = () => {
    posthog.capture("google_sign_in_initiated")
    signIn.social({ provider: "google", callbackURL })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) {
      return
    }
    setError(null)
    setPending(true)

    // When Turnstile is configured, attach the token; the server rejects the
    // request without it (the submit button stays disabled until it resolves).
    const fetchOptions = captchaToken
      ? { headers: { "x-captcha-response": captchaToken } }
      : undefined

    if (method === "magic") {
      // The clicked link lands on the static /signed-in ("you can close this
      // tab") page — the original tab handles the real redirect via its session
      // poll. Keep this callback query-free: better-auth rejects callbackURLs
      // that nest a path-with-query (the inner `?` fails its validation regex).
      const { error: err } = await signIn.magicLink({
        email: email.trim(),
        callbackURL: "/signed-in",
        fetchOptions,
      })
      setPending(false)
      resetCaptcha()
      if (err) {
        setError(err.message ?? "Couldn't send the link. Try again.")
      } else {
        posthog.capture("magic_link_requested", { method: "magic_link" })
        onMagicSent()
      }
      return
    }

    const result =
      mode === "signup"
        ? await signUp.email({
            email: email.trim(),
            password,
            name: email.trim().split("@")[0] ?? "",
            callbackURL,
            fetchOptions,
          })
        : await signIn.email({
            email: email.trim(),
            password,
            callbackURL,
            fetchOptions,
          })

    setPending(false)
    if (result.error) {
      setError(result.error.message ?? "Something went wrong. Try again.")
      resetCaptcha()
      return
    }
    // Both paths land on the destination (a hard nav). Flag the landing so the
    // EmailVerificationProvider pops the verify modal once if the account isn't
    // verified yet; verified accounts just land.
    posthog.capture(mode === "signup" ? "user_signed_up" : "user_signed_in", {
      method: "password",
    })
    posthog.identify(email.trim(), { email: email.trim() })
    sessionStorage.setItem(JUST_AUTHED_KEY, "1")
    window.location.assign(callbackURL)
  }

  const passwordLabel = mode === "signup" ? "Create account" : "Log in"
  const primaryLabel = method === "magic" ? "Send magic link" : passwordLabel
  const emailSuggestion = suggestEmailFix(email)

  return (
    <div className="mt-5 flex flex-col gap-3">
      {config.data?.googleEnabled && (
        <>
          <Button
            className="w-full"
            onClick={handleGoogle}
            size="lg"
            type="button"
            variant="outline"
          >
            <GoogleLogoIcon weight="bold" />
            Continue with Google
          </Button>
          <Divider />
        </>
      )}

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

        {method === "password" && (
          <Input
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            className="h-9 text-sm"
            disabled={pending}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
        )}

        {method === "password" && mode === "signin" && (
          <button
            className="-mt-0.5 self-end text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
            disabled={pending}
            onClick={onForgot}
            type="button"
          >
            Forgot password?
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
          {pending ? <Spinner className="text-current" /> : primaryLabel}
        </Button>

        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>

      <button
        className="text-center text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
        onClick={() => {
          setError(null)
          setMethod((m) => (m === "magic" ? "password" : "magic"))
        }}
        type="button"
      >
        {method === "magic" ? "Use a password" : "Use a magic link"}
      </button>

      {mode === "signup" && (
        <p className="text-balance text-center text-[11px] text-muted-foreground leading-relaxed">
          By continuing you agree to our{" "}
          <Link
            className="underline underline-offset-2 hover:text-foreground"
            href="/terms"
            target="_blank"
          >
            Terms
          </Link>{" "}
          &{" "}
          <Link
            className="underline underline-offset-2 hover:text-foreground"
            href="/privacy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  )
}
