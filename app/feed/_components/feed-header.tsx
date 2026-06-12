"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Logo } from "@/components/ui/logo"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/", label: "Feed" },
  { href: "/files", label: "Files" },
  { href: "/library", label: "Library" },
]

export function FeedHeader() {
  const pathname = usePathname()

  return (
    // Fixed to the viewport so it stays put while videos scroll underneath.
    // pointer-events-none lets taps fall through to the video; the interactive
    // bits opt back in.
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
      {/* Mobile: progressively blur the video out behind the header so the logo
          + tabs stay legible. Desktop keeps the plain dark gradient below. */}
      <ProgressiveBlur
        blurIntensity={2}
        blurLayers={6}
        className="absolute inset-x-0 top-0 h-28 lg:hidden"
        direction="top"
      />
      <div className="relative bg-gradient-to-b from-black/40 to-transparent pb-3 lg:from-black/70">
        <div className="relative flex items-center justify-center px-4 py-3">
          <Logo className="pointer-events-auto h-3" />
          {/* Mobile only — desktop uses the top-right auth control. */}
          <div className="pointer-events-auto absolute right-3 lg:hidden">
            <MobileNav triggerClassName="size-9 text-white/90 hover:text-white" />
          </div>
        </div>

        <nav className="pointer-events-auto flex items-center justify-center gap-6 font-mono text-xs uppercase tracking-wide">
          {tabs.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                className={cn(
                  "transition-colors",
                  active
                    ? "font-semibold text-white"
                    : "font-medium text-white/55 hover:text-white/90"
                )}
                href={href}
                key={href}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
