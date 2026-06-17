import { Dialog } from "@base-ui/react/dialog"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"
import { getStaticAssetUrl } from "@/lib/file-url"
import type { AuthMode, AuthStep } from "./auth-types"

/** Archive photo fading into the modal background. */
export function AuthHeroImage() {
  return (
    <div className="relative h-44 w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{
          backgroundImage: `url(${getStaticAssetUrl("auth-archive.webp")})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/20" />
      <div className="absolute inset-x-0 bottom-7 flex justify-center">
        <Logo className="h-7 w-auto text-white" />
      </div>
    </div>
  )
}

/**
 * Title + one supporting line, driven by the current step. The email lives in
 * the subtitle for the "sent"/verify steps so every state keeps the same
 * title→subtitle rhythm — no stacked extra lines.
 */
export function AuthHeading({
  step,
  mode,
  email,
}: {
  step: AuthStep
  mode: AuthMode
  email: string
}) {
  const { title, subtitle } = heroCopy(step, mode, email)
  return (
    <>
      <Dialog.Title className="text-center font-semibold text-2xl tracking-tight">
        {title}
      </Dialog.Title>
      {subtitle && (
        <p className="mt-1.5 text-balance text-center text-muted-foreground text-sm leading-relaxed">
          {subtitle}
        </p>
      )}
    </>
  )
}

function sentTo(prefix: string, email: string): ReactNode {
  return (
    <>
      {prefix} <span className="font-medium text-foreground">{email}</span>.
    </>
  )
}

function heroCopy(
  step: AuthStep,
  mode: AuthMode,
  email: string
): { title: string; subtitle: ReactNode | null } {
  if (step === "forgot") {
    return {
      title: "Reset your password",
      subtitle: "We'll email you a reset link.",
    }
  }
  if (step === "resetSent") {
    return {
      title: "Check your email",
      subtitle: sentTo(
        "If an account exists with this email, we'll send a reset link to",
        email
      ),
    }
  }
  if (step === "magicSent") {
    return {
      title: "Check your email",
      subtitle: sentTo("Sign-in link sent to", email),
    }
  }
  if (mode === "signup") {
    return {
      title: "Create an account",
      subtitle: "Save files and clips to your library.",
    }
  }
  return { title: "Welcome back", subtitle: "Sign in to continue." }
}
