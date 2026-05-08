"use client"

import { GithubLogoIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

export function SiteFooter() {
  return (
    <footer className="border-border/40 border-t bg-background">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="https://x.com/noahwebdev"
          target="_blank"
          rel="noopener noreferrer"
        >
          <p className="text-muted-foreground text-xs underline-offset-2 hover:underline">
            made by noah
          </p>
        </Link>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Logo className="h-3" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/noahcousins/ufofiles"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubLogoIcon className="size-4 text-muted-foreground hover:text-foreground" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
