"use client"

import { Dialog } from "@base-ui/react/dialog"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { AuthHeading, AuthHeroImage } from "./auth-hero"
import { ModeSwitch } from "./auth-parts"
import type { AuthMode, AuthStep } from "./auth-types"
import { CredentialsForm } from "./credentials-form"
import { ForgotPasswordForm } from "./forgot-password-form"
import { MagicLinkWatcher } from "./magic-link-watcher"

interface AuthDialogProps {
  /** Where to land after sign-in. Defaults to the Library. */
  callbackURL?: string
  /** Which tab opens first. The `/login` route passes "signin". */
  initialMode?: AuthMode
  onOpenChange: (open: boolean) => void
  open: boolean
}

/**
 * Auth modal orchestrator: owns the shared mode/step/email and routes between
 * the sub-views (each in its own file). The flows live in credentials-form,
 * forgot-password-form, and magic-link-watcher. Email verification is handled
 * separately by the global EmailVerificationProvider (it pops after sign-up/in
 * when unverified), so it isn't a step here.
 */
export function AuthDialog({
  open,
  onOpenChange,
  callbackURL = "/library",
  initialMode = "signup",
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [step, setStep] = useState<AuthStep>("form")
  // Lifted so it carries between the sign-in and forgot forms and feeds the
  // "check your email" / verify screens.
  const [email, setEmail] = useState("")

  // A single dialog instance is reused across opens — honour the requested tab
  // and clear transient state each time it opens.
  useEffect(() => {
    if (!open) {
      return
    }
    setMode(initialMode)
    setStep("form")
    setEmail("")
  }, [open, initialMode])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setStep("form")
  }

  const showFooter = step === "form"

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-opacity data-[starting-style]:transition-opacity" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[22rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-border bg-background shadow-2xl outline-none",
            "data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-all data-[starting-style]:transition-all"
          )}
        >
          <AuthHeroImage />

          <div className="px-6 pb-6">
            <AuthHeading email={email} mode={mode} step={step} />

            {step === "form" && (
              <CredentialsForm
                callbackURL={callbackURL}
                email={email}
                mode={mode}
                onEmailChange={setEmail}
                onForgot={() => setStep("forgot")}
                onMagicSent={() => setStep("magicSent")}
              />
            )}

            {step === "forgot" && (
              <ForgotPasswordForm
                email={email}
                onBack={() => setStep("form")}
                onEmailChange={setEmail}
                onSent={() => setStep("resetSent")}
              />
            )}

            {step === "magicSent" && (
              <MagicLinkWatcher callbackURL={callbackURL} />
            )}

            {showFooter && (
              <p className="mt-5 border-border border-t pt-4 text-center text-muted-foreground text-xs">
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <ModeSwitch
                      label="Log in"
                      onClick={() => switchMode("signin")}
                    />
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <ModeSwitch
                      label="Create an account"
                      onClick={() => switchMode("signup")}
                    />
                  </>
                )}
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
