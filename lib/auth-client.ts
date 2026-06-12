"use client"

import { anonymousClient, magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [anonymousClient(), magicLinkClient()],
})

export const { useSession, signIn, signUp, signOut, getSession } = authClient

/**
 * Ensure a session exists before a mark (ADR-0003). The first mark silently
 * creates a Guest; subsequent marks reuse it. Returns the active user id.
 */
export async function ensureGuestSession(): Promise<string | null> {
  const { data } = await authClient.getSession()
  if (data?.user) {
    return data.user.id
  }
  const result = await authClient.signIn.anonymous()
  return result.data?.user?.id ?? null
}

/** A Member is a non-anonymous, verified User — the only kind that can Export. */
export function isMember(
  user:
    | { isAnonymous?: boolean | null; emailVerified?: boolean }
    | null
    | undefined
): boolean {
  return Boolean(user && !user.isAnonymous && user.emailVerified)
}
