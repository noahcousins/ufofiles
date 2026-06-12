"use client"

import { SignOutIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { useState } from "react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { Button } from "@/components/ui/button"
import { isMember, signOut, useSession } from "@/lib/auth-client"

const iconButton =
  "flex size-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"

/**
 * Desktop-only auth control for the feed, pinned top-right. Hidden on mobile,
 * where the feed stays full-screen and auth lives in the header sheet.
 */
export function FeedAuth() {
  const [authOpen, setAuthOpen] = useState(false)
  const { data: session } = useSession()
  const member = isMember(session?.user)

  return (
    <>
      <div className="fixed top-3 right-3 z-50 hidden items-center gap-2 lg:flex">
        {member ? (
          <>
            <Link aria-label="Library" className={iconButton} href="/library">
              <UserCircleIcon className="size-5" weight="fill" />
            </Link>
            <button
              aria-label="Sign out"
              className={iconButton}
              onClick={() => signOut()}
              type="button"
            >
              <SignOutIcon className="size-5" />
            </button>
          </>
        ) : (
          <Button onClick={() => setAuthOpen(true)} size="sm" variant="default">
            Sign in
          </Button>
        )}
      </div>

      <AuthDialog onOpenChange={setAuthOpen} open={authOpen} />
    </>
  )
}
