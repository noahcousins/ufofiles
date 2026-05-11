"use client"

import {
  DownloadSimple,
  GithubLogoIcon,
  GlobeHemisphereWest,
  ListIcon,
  MagnifyingGlassIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Logo } from "@/components/ui/logo"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Search", icon: MagnifyingGlassIcon },
  { href: "/globe", label: "Incident Map", icon: GlobeHemisphereWest },
  { href: "/releases", label: "Downloads", icon: DownloadSimple },
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
  onMobileSearchToggle?: () => void
}

export function Header({
  children,
  mobileSearchOpen,
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

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
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

        {/* Desktop social links */}
        <div className="hidden items-center gap-1 md:flex">
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

        <div className="flex items-center gap-1 md:hidden">
          {/* Mobile search icon */}
          {isMainPage ? (
            <button
              aria-label="Toggle search"
              className={cn(
                "inline-flex size-8 items-center justify-center transition-colors hover:text-foreground",
                mobileSearchOpen
                  ? "text-foreground"
                  : "text-muted-foreground"
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

          {/* Mobile menu */}
          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger
              aria-label="Open menu"
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ListIcon className="size-5" />
            </SheetTrigger>
            <SheetContent className="w-72 rounded-none" side="right">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="flex flex-col gap-0.5 p-4 pt-12">
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 font-medium text-muted-foreground text-xs transition-all hover:bg-muted hover:text-foreground active:translate-y-px",
                      pathname === href && "bg-muted text-foreground"
                    )}
                    href={href}
                    key={href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="size-5" />
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto border-border/40 border-t p-4">
                <div className="flex items-center gap-2">
                  {socialLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      aria-label={label}
                      className="inline-flex size-10 items-center justify-center text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:translate-y-px"
                      href={href}
                      key={href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Icon className="size-5" />
                    </Link>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {children}
    </header>
  )
}
