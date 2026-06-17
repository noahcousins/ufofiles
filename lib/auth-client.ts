"use client"

import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), emailOTPClient()],
})

// Raw better-auth primitives still used directly. Session *reads* go through the
// Zustand store (see `lib/auth/session-provider` — `useSession`, `useAuthActions`)
// rather than better-auth's reactive `useSession` hook, so the session can be
// preloaded server-side and passed down without flashing.
export const { signIn, signUp } = authClient

/** A Member is a verified User — the only kind that can Clip / Export. */
export function isMember(
  user: { emailVerified?: boolean } | null | undefined
): boolean {
  return Boolean(user?.emailVerified)
}
