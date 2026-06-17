"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useAuthActions, useSession } from "@/lib/auth/session-provider"
import { isMember } from "@/lib/auth-client"
import { VerifyEmailDialog } from "./verify-email-dialog"

/**
 * One-shot flag set by the auth form right before its post-auth hard nav, so the
 * verify modal pops exactly once on landing (and only after a real sign-up/in) —
 * then it's cleared. Avoids a sticky "already prompted" flag that would suppress
 * the modal on the next account in the same browser session.
 */
export const JUST_AUTHED_KEY = "ufofiles:just-authed"

/**
 * Gate an action behind email verification. Returns `true` (and runs the
 * callback) if already verified; otherwise opens the verify modal and returns
 * `false`. Signed-out users return `false` without prompting — the caller's own
 * auth modal handles sign-in first.
 */
type RequireVerified = (onVerified?: () => void) => boolean

const RequireVerifiedContext = createContext<RequireVerified | null>(null)

export function EmailVerificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const { refetch } = useAuthActions()
  const [open, setOpen] = useState(false)
  const onVerifiedRef = useRef<(() => void) | null>(null)

  const user = session?.user ?? null
  const verified = isMember(user)

  const requireVerified = useCallback<RequireVerified>(
    (onVerified) => {
      if (verified) {
        onVerified?.()
        return true
      }
      if (!user) {
        return false
      }
      onVerifiedRef.current = onVerified ?? null
      setOpen(true)
      return false
    },
    [verified, user]
  )

  // Right after a sign-up/in, the auth form sets JUST_AUTHED_KEY and hard-navs.
  // On landing we consume that flag once: prompt to verify if unverified, then
  // clear it. Waits for the session so a not-yet-hydrated read can't swallow the
  // flag. Ordinary page loads (no flag) never prompt; gated actions still do.
  useEffect(() => {
    if (!user) {
      return
    }
    if (!sessionStorage.getItem(JUST_AUTHED_KEY)) {
      return
    }
    sessionStorage.removeItem(JUST_AUTHED_KEY)
    if (!verified) {
      setOpen(true)
    }
  }, [user, verified])

  const handleVerified = useCallback(async () => {
    await refetch()
    setOpen(false)
    const cb = onVerifiedRef.current
    onVerifiedRef.current = null
    cb?.()
  }, [refetch])

  return (
    <RequireVerifiedContext.Provider value={requireVerified}>
      {children}
      {user && (
        <VerifyEmailDialog
          email={user.email}
          onOpenChange={setOpen}
          onVerified={handleVerified}
          open={open}
        />
      )}
    </RequireVerifiedContext.Provider>
  )
}

export function useRequireVerified(): RequireVerified {
  const ctx = useContext(RequireVerifiedContext)
  if (!ctx) {
    throw new Error(
      "useRequireVerified must be used within <EmailVerificationProvider>"
    )
  }
  return ctx
}
