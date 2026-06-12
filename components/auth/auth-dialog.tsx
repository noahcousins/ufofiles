"use client"

import { Dialog } from "@base-ui/react/dialog"
import {
  EnvelopeSimpleIcon,
  GoogleLogoIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/ui/logo"
import { Turnstile } from "@/components/ui/turnstile"
import { signIn, signUp } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

interface AuthDialogProps {
  /** Where to land after sign-in. Defaults to the Library. */
  callbackURL?: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

type Mode = "signin" | "signup"
type Method = "magic" | "password"

export function AuthDialog({
  open,
  onOpenChange,
  callbackURL = "/library",
}: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("signup")
  const [method, setMethod] = useState<Method>("magic")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  // Turnstile token + a key to force a fresh widget (tokens are single-use, so
  // we remount the widget after every submit).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  const config = trpc.me.config.useQuery(undefined, { enabled: open })

  const reset = () => {
    setError(null)
    setMagicSent(false)
  }

  const resetCaptcha = () => {
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }

  const handleGoogle = () => {
    // Social sign-in redirects the browser; the anonymous plugin merges the
    // Guest's marks server-side on link.
    signIn.social({ provider: "google", callbackURL })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) {
      return
    }
    reset()
    setPending(true)

    // When Turnstile is configured, attach the token; the server rejects the
    // request without it (the submit button stays disabled until it resolves).
    const fetchOptions = captchaToken
      ? { headers: { "x-captcha-response": captchaToken } }
      : undefined

    if (method === "magic") {
      const { error: err } = await signIn.magicLink({
        email: email.trim(),
        callbackURL,
        fetchOptions,
      })
      setPending(false)
      resetCaptcha()
      if (err) {
        setError(err.message ?? "Couldn't send the link. Try again.")
      } else {
        setMagicSent(true)
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
    // Land on the destination with a fresh session.
    window.location.assign(callbackURL)
  }

  const title = mode === "signup" ? "Sign up" : "Sign in"
  const passwordLabel = mode === "signup" ? "Create account" : "Log in"
  const primaryLabel = method === "magic" ? "Send magic link" : passwordLabel

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-opacity data-[starting-style]:transition-opacity" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-background shadow-2xl outline-none",
            "data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-all data-[starting-style]:transition-all"
          )}
        >
          <div className="flex items-center justify-between border-border border-b bg-muted/20 px-5 py-3.5">
            <Logo className="h-3 w-auto text-foreground" />
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-4" />
            </Dialog.Close>
          </div>

          <div className="p-5">
            <Dialog.Title className="font-semibold text-base">
              {title}
            </Dialog.Title>

            {magicSent ? (
              <div className="mt-5 flex flex-col items-center gap-3 border border-border border-dashed bg-muted/20 px-4 py-7 text-center">
                <div className="flex size-10 items-center justify-center border border-border bg-background">
                  <EnvelopeSimpleIcon className="size-5" weight="duotone" />
                </div>
                <p className="text-xs leading-relaxed">
                  Check <span className="font-medium">{email}</span> for a
                  sign-in link.
                </p>
              </div>
            ) : (
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />

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

                  {turnstileSiteKey && (
                    <Turnstile
                      key={captchaKey}
                      onToken={setCaptchaToken}
                      siteKey={turnstileSiteKey}
                    />
                  )}

                  <Button
                    className="w-full"
                    disabled={
                      pending || (Boolean(turnstileSiteKey) && !captchaToken)
                    }
                    size="lg"
                    type="submit"
                  >
                    {pending ? "Working…" : primaryLabel}
                  </Button>

                  {error && <p className="text-destructive text-xs">{error}</p>}
                </form>

                <button
                  className="text-center text-muted-foreground text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  onClick={() => {
                    reset()
                    setMethod((m) => (m === "magic" ? "password" : "magic"))
                  }}
                  type="button"
                >
                  {method === "magic" ? "Use a password" : "Use a magic link"}
                </button>
              </div>
            )}

            <p className="mt-5 border-border border-t pt-4 text-center text-muted-foreground text-xs">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <ModeSwitch
                    label="Log in"
                    onClick={() => {
                      reset()
                      setMode("signin")
                    }}
                  />
                </>
              ) : (
                <>
                  New here?{" "}
                  <ModeSwitch
                    label="Create an account"
                    onClick={() => {
                      reset()
                      setMode("signup")
                    }}
                  />
                </>
              )}
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-wide">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function ModeSwitch({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="font-medium text-foreground underline-offset-2 hover:underline"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}
