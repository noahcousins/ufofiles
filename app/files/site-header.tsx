"use client"

import {
  GlobeHemisphereWest,
  MagnifyingGlassIcon,
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
        </div>
      </div>
      {children}
    </header>
  )
}
