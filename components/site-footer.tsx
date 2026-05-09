"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

export function SiteFooter() {
  return (
    <footer className="border-border/40 border-t bg-background">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo className="h-3" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
