"use client"

import { useConsentManager } from "@c15t/nextjs"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

const footerLinkClass =
  "text-muted-foreground text-xs transition-colors hover:text-foreground"

export function SiteFooter({
  consentRequired = true,
}: {
  consentRequired?: boolean
}) {
  // Re-opens the consent banner (force = show even though a choice was already
  // made), preserving the existing selection so the User can change it.
  const { setActiveUI } = useConsentManager()

  return (
    <footer className="border-border/40 border-t bg-background">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo className="h-3" />
        <div className="flex items-center gap-3">
          <Link className={footerLinkClass} href="/privacy">
            Privacy
          </Link>
          <Link className={footerLinkClass} href="/terms">
            Terms
          </Link>
          {consentRequired && (
            <button
              className={footerLinkClass}
              onClick={() => setActiveUI("banner", { force: true })}
              type="button"
            >
              Cookie preferences
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
