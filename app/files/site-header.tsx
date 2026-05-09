"use client"

import {
  DownloadSimple,
  GithubLogoIcon,
  GlobeHemisphereWest,
  MagnifyingGlassIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-border/40 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Logo className="h-3.5" />
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                pathname === "/" && "text-foreground"
              )}
              aria-label="Home"
            >
              <MagnifyingGlassIcon className="size-4" />
            </Link>
            <Link
              href="/globe"
              className={cn(
                "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                pathname === "/globe" && "text-foreground"
              )}
              aria-label="Incident map"
            >
              <GlobeHemisphereWest className="size-4" />
            </Link>
            <Link
              href="/releases"
              className={cn(
                "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                pathname === "/releases" && "text-foreground"
              )}
              aria-label="Downloads"
            >
              <DownloadSimple className="size-4" />
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="https://x.com/noahwebdev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <XLogoIcon className="size-4 text-muted-foreground hover:text-foreground" />
          </Link>
          <Link
            href="https://github.com/noahcousins/ufofiles"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubLogoIcon className="size-4 text-muted-foreground hover:text-foreground" />
          </Link>
        </div>
      </div>
      {children}
    </header>
  )
}
