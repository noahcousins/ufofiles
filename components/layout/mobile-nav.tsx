"use client"

import {
  ListIcon,
  SignInIcon,
  SignOutIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { navLinks, socialLinks } from "@/components/layout/nav-items"
import { Logo } from "@/components/ui/logo"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { isMember, signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const rowClass =
  "flex items-center gap-3 px-3 py-3 font-medium text-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:translate-y-px"

/**
 * The hamburger + slide-out nav sheet, shared by the header and the feed so the
 * two stay identical. `triggerClassName` lets callers restyle the button (e.g.
 * white over the dark feed).
 */
export function MobileNav({ triggerClassName }: { triggerClassName?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { data: session } = useSession()
  const member = isMember(session?.user)

  return (
    <>
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          aria-label="Open menu"
          className={cn(
            "inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
            triggerClassName
          )}
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
                  rowClass,
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
                className={rowClass}
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

          <Separator className="w-full" />
          <div className="flex flex-col gap-0.5 p-4">
            {member ? (
              <>
                {session?.user?.email && (
                  <span className="px-3 py-2 text-muted-foreground text-sm">
                    {session.user.email}
                  </span>
                )}
                <button
                  className={rowClass}
                  onClick={() => {
                    setOpen(false)
                    signOut()
                  }}
                  type="button"
                >
                  <SignOutIcon className="size-8" />
                  Sign out
                </button>
              </>
            ) : (
              <button
                className={rowClass}
                onClick={() => {
                  setOpen(false)
                  setAuthOpen(true)
                }}
                type="button"
              >
                <SignInIcon className="size-8" />
                Sign in
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AuthDialog onOpenChange={setAuthOpen} open={authOpen} />
    </>
  )
}
