"use client"

import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AuthButtons } from "@/components/auth/auth-buttons"
import { MobileNav } from "@/components/layout/mobile-nav"
import { navLinks, socialLinks } from "@/components/layout/nav-items"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"

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

          <AuthButtons variant="header" />
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

          <MobileNav />
        </div>
      </div>
      {children}
    </header>
  )
}
