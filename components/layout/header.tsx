"use client"

import {
  ArrowRightIcon,
  ClockCounterClockwise,
  DownloadSimple,
  GithubLogoIcon,
  GlobeHemisphereWest,
  ListIcon,
  MagnifyingGlassIcon,
  MonitorPlayIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Search", icon: MagnifyingGlassIcon },
  { href: "/feed", label: "Feed", icon: MonitorPlayIcon },
  { href: "/globe", label: "Incident Map", icon: GlobeHemisphereWest },
  { href: "/releases", label: "Releases", icon: DownloadSimple },
  { href: "/changelog", label: "Changelog", icon: ClockCounterClockwise },
]

const socialLinks = [
  {
    href: "https://x.com/noahwebdev",
    label: "X (Twitter)",
    icon: XLogoIcon,
  },
  {
    href: "https://github.com/noahcousins/ufofiles",
    label: "GitHub",
    icon: GithubLogoIcon,
  },
]

interface HeaderProps {
  children?: React.ReactNode
  mobileSearchOpen?: boolean
  newReleaseName?: string | null
  onMobileSearchToggle?: () => void
  onNewReleaseClick?: () => void
}

export function Header({
  children,
  mobileSearchOpen,
  newReleaseName,
  onNewReleaseClick,
  onMobileSearchToggle,
}: HeaderProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isMainPage = pathname === "/"

  return (
    <header className="sticky top-0 z-40 border-border/40 border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Logo className="h-3.5" />
          {newReleaseName && (
            <Link
              href={`/?release=${encodeURIComponent(newReleaseName)}`}
              onClick={onNewReleaseClick}
            >
              <Button size="xs" variant="default">
                Release 02 out now
                <ArrowRightIcon className="size-4" />
              </Button>
            </Link>
          )}

          <div className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                aria-label={label}
                className={cn(
                  "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                  pathname === href && "text-foreground"
                )}
                href={href}
                key={href}
              >
                <Icon className="size-4" />
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <Link
              aria-label={label}
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              href={href}
              key={href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className="size-4" />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          {isMainPage ? (
            <button
              aria-label="Toggle search"
              className={cn(
                "inline-flex size-8 items-center justify-center transition-colors hover:text-foreground",
                mobileSearchOpen ? "text-foreground" : "text-muted-foreground"
              )}
              onClick={onMobileSearchToggle}
              type="button"
            >
              <MagnifyingGlassIcon className="size-5" />
            </button>
          ) : (
            <Link
              aria-label="Search files"
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              href="/?searchOpen=1"
            >
              <MagnifyingGlassIcon className="size-5" />
            </Link>
          )}

          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ListIcon className="size-5" />
            </SheetTrigger>
            <SheetContent className="w-72 rounded-none" side="right">
              <SheetHeader>
                <Logo className="h-6" />
                <SheetTitle className="sr-only">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-0.5 p-4">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 font-medium text-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:translate-y-px",
                      pathname === href && "bg-muted text-foreground"
                    )}
                    href={href}
                    key={href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="size-8" />
                    {label}
                  </Link>
                ))}
              </nav>
              <Separator className="w-full" />
              <nav className="flex flex-col gap-0.5 p-4">
                {socialLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 font-medium text-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:translate-y-px",
                      pathname === href && "bg-muted text-foreground"
                    )}
                    href={href}
                    key={href}
                    onClick={() => setOpen(false)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="size-8" />
                    {label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {children}
    </header>
  )
}
