"use client"

import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import { AuthHeroImage } from "./auth-hero"
import { VerifyOtpForm } from "./verify-otp-form"

/**
 * Standalone email-verification modal (the "2FA" step). Reuses the auth modal's
 * shell so it reads as part of the same flow. Driven by EmailVerification
 * provider — opens after sign-up/in when unverified, or when a gated action
 * (bookmark/clip) is attempted by an unverified user.
 */
export function VerifyEmailDialog({
  email,
  open,
  onOpenChange,
  onVerified,
}: {
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified: () => void
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-opacity data-[starting-style]:transition-opacity" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-88 -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-border bg-background shadow-2xl outline-none",
            "data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-all data-[starting-style]:transition-all"
          )}
        >
          <AuthHeroImage />
          <div className="px-6 pb-6">
            <Dialog.Title className="text-center font-semibold text-2xl tracking-tight">
              Verify your email
            </Dialog.Title>
            <p className="mt-1.5 text-balance text-center text-muted-foreground text-sm leading-relaxed">
              Enter the code we sent to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            <VerifyOtpForm email={email} onVerified={onVerified} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
