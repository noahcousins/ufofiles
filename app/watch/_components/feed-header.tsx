"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Logo } from "@/components/ui/logo"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/watch", label: "Watch" },
  { href: "/", label: "Files" },
  { href: "/map", label: "Map" },
]

export function FeedHeader({
  filterControl,
}: {
  filterControl?: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    // Fixed to the viewport so it stays put while videos scroll underneath.
    // pointer-events-none lets taps fall through to the video; the interactive
    // bits opt back in.
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
      {/* Progressively blur the video out behind the header (desktop + mobile)
          so the logo + tabs stay legible while the video stays visible. */}
      <ProgressiveBlur
        blurIntensity={3}
        blurLayers={6}
        className="absolute inset-x-0 top-0 h-32"
        direction="top"
      />
      <div className="relative bg-gradient-to-b from-black/30 to-transparent pb-3">
        <div className="relative flex items-center justify-center px-4 py-3">
          {/* Always white — the feed sits over dark video regardless of theme. */}
          <Logo className="pointer-events-auto h-3 text-white" />
        </div>

        {/* Mobile only — desktop uses the top-right auth control. Centered
            against the whole header (logo + tabs), pinned right. */}
        <div className="pointer-events-auto absolute inset-y-0 right-3 flex items-center lg:hidden">
          <MobileNav triggerClassName="size-9 text-white/90 hover:text-white" />
        </div>

        {/* Filter drawer trigger, pinned left to mirror the nav control. */}
        {filterControl && (
          <div className="pointer-events-auto absolute inset-y-0 left-3 flex items-center">
            {filterControl}
          </div>
        )}

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
