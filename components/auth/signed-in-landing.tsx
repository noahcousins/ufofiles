"use client"

import { CheckIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { AuthHeroImage } from "@/components/auth/auth-hero"
import { Button } from "@/components/ui/button"

const COUNTDOWN_SECONDS = 5

/**
 * Landing page for the tab that opened the magic link. The original tab is
 * already polling for the session and will redirect itself, so here we just
 * confirm success and nudge the user back. We attempt window.close() at zero,
 * but browsers block closing tabs a script didn't open — so the copy works
 * whether or not the close succeeds, and the continue button is the fallback
 * for when there's no original tab. Mirrors the auth modal's shell for
 * consistency.
 */
export function SignedInLanding() {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (seconds <= 0) {
      // Best-effort — silently ignored for user-opened tabs.
      window.close()
      return
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-88 overflow-hidden border border-border bg-background shadow-2xl">
        <AuthHeroImage />

        <div className="px-6 pt-5 pb-6 text-center">
          <CheckIcon className="mx-auto size-6 text-foreground" />
          <h1 className="mt-3 font-semibold text-2xl tracking-tight">
            You're signed in
          </h1>
          <p className="mt-1.5 text-balance text-muted-foreground text-sm leading-relaxed">
            Head back to your original tab.
          </p>

          <p className="mt-4 text-muted-foreground text-xs tabular-nums">
            {seconds > 0
              ? `This tab will close in ${seconds}s…`
              : "You can close this tab now."}
          </p>

          <Link className="mt-5 block" href="/">
            <Button className="w-full" size="lg" variant="outline">
              Continue here
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
