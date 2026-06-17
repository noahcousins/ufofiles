"use client"

import {
  GearSixIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import posthog from "posthog-js"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ProfileAvatar } from "@/components/ui/profile-avatar"
import { toast } from "@/components/ui/toast"
import { useAuthActions, useSession } from "@/lib/auth/session-provider"

/** Which tab the auth dialog should open on. */
type AuthMode = "signin" | "signup"

/**
 * Where the auth control is mounted. Each context styles its trigger/buttons
 * differently (compact icons in the header — also used over the feed —
 * full-width rows in the mobile sheet, labelled buttons in the library).
 */
type AuthVariant = "header" | "mobile" | "library"

const mobileRowClass =
  "flex w-full items-center gap-3 px-3 py-3 text-left font-medium text-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:translate-y-px"

const popoverItemClass =
  "flex w-full items-center gap-2 px-2.5 py-2 text-left text-foreground text-xs outline-none transition-colors hover:bg-muted focus-visible:bg-muted"

/**
 * The auth control shared across the app: a profile popover (with a log-out
 * option) when signed in, or sign-in/up buttons otherwise. The sign-in dialog
 * itself is global (AuthDialogProvider) — this just calls `open()`, which
 * captures the current URL so sign-in returns the user here.
 */
export function AuthButtons({
  variant = "header",
  onNavigate,
}: {
  variant?: AuthVariant
  onNavigate?: () => void
}) {
  const openAuth = useAuthDialog()
  const { data: session } = useSession()

  const handleAuth = (mode: AuthMode) => {
    // Close the mobile sheet (if we're in it) before the global modal opens.
    onNavigate?.()
    openAuth(mode)
  }

  if (session?.user) {
    return (
      <ProfileMenu
        email={session.user.email}
        onNavigate={onNavigate}
        variant={variant}
      />
    )
  }

  return <GuestButtons onAuth={handleAuth} variant={variant} />
}

/** The signed-in profile: a popover trigger plus its log-out menu. */
function ProfileMenu({
  variant,
  email,
  onNavigate,
}: {
  variant: AuthVariant
  email?: string | null
  onNavigate?: () => void
}) {
  const { signOut } = useAuthActions()
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch {
      // Cookie wasn't cleared — keep the user signed in and let them retry
      // rather than hard-navigating into a half-logged-out state.
      toast("Couldn't log out. Try again.")
      return
    }
    posthog.capture("user_signed_out")
    posthog.reset()
    // Hard navigation home so middleware + the (protected) server layout re-run
    // with the cleared cookie and decide where the now-guest belongs — the
    // server owns the redirect, no client-side session guard needed. (A soft
    // router.push wouldn't re-run them.) The full reload also drops all cached
    // client state, so no manual cache invalidation is required.
    window.location.assign("/")
  }

  return (
    <Popover>
      <PopoverTrigger render={profileTrigger(variant, email)} />
      <PopoverContent
        align={variant === "mobile" ? "center" : "end"}
        className="w-56 gap-0 overflow-hidden p-0"
      >
        {email && (
          <div className="border-border border-b px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Signed in
            </p>
            <p className="truncate font-medium text-foreground text-xs">
              {email}
            </p>
          </div>
        )}
        <div className="flex flex-col py-1">
          <Link
            className={popoverItemClass}
            href="/library"
            onClick={onNavigate}
          >
            <UserCircleIcon className="size-4" />
            Library
          </Link>
          <Link
            className={popoverItemClass}
            href="/account"
            onClick={onNavigate}
          >
            <GearSixIcon className="size-4" />
            Account
          </Link>
          <button
            className={popoverItemClass}
            onClick={handleSignOut}
            type="button"
          >
            <SignOutIcon className="size-4" />
            Log out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function profileTrigger(variant: AuthVariant, email?: string | null) {
  if (variant === "mobile") {
    return (
      <button className={mobileRowClass} type="button">
        <ProfileAvatar seed={email} size={32} />
        <span className="truncate">{email ?? "Account"}</span>
      </button>
    )
  }
  if (variant === "library") {
    return (
      <button
        aria-label="Account"
        className="flex items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground aria-expanded:text-foreground"
        type="button"
      >
        <ProfileAvatar seed={email} size={18} />
        {email && <span className="max-w-40 truncate">{email}</span>}
      </button>
    )
  }
  return (
    <button
      aria-label="Account"
      className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground aria-expanded:text-foreground"
      type="button"
    >
      <ProfileAvatar seed={email} size={22} />
    </button>
  )
}

/** The signed-out call to action, styled per context. */
function GuestButtons({
  variant,
  onAuth,
}: {
  variant: AuthVariant
  onAuth: (mode: AuthMode) => void
}) {
  if (variant === "mobile") {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={() => onAuth("signin")} size="lg" variant="secondary">
          Log in
        </Button>
        <Button onClick={() => onAuth("signup")} size="lg" variant="default">
          Sign up
        </Button>
      </div>
    )
  }
  if (variant === "library") {
    return (
      <Button onClick={() => onAuth("signup")} size="sm">
        Sign in to save &amp; export
      </Button>
    )
  }
  return (
    <>
      <Button
        onClick={() => onAuth("signin")}
        size="default"
        variant="secondary"
      >
        Log in
      </Button>
      <Button onClick={() => onAuth("signup")} size="default" variant="default">
        Sign up
      </Button>
    </>
  )
}
