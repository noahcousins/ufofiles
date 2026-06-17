"use client"

import { createStore } from "zustand/vanilla"
// Type-only import — fully erased at build time, so this never pulls the
// server-only `auth` (drizzle, env, …) into the client bundle.
import type { auth } from "@/lib/auth"
import { authClient } from "@/lib/auth-client"

/** The `{ session, user }` shape better-auth returns from `getSession`. */
export type AppSession = typeof auth.$Infer.Session

export interface SessionState {
  /** True only while an in-place refetch is in flight (sign-in flows reload). */
  isPending: boolean
  /** Re-read the session from `/api/auth` and write it into the store. */
  refetch: () => Promise<AppSession | null>
  /** The active session, preloaded from the server so there's no auth flash. */
  session: AppSession | null

  setSession: (session: AppSession | null) => void
  signOut: () => Promise<void>
}

export type SessionStore = ReturnType<typeof createSessionStore>

/**
 * One store per render tree, seeded from the server-fetched session. Created in
 * the provider via a ref so a fresh request never shares state with another.
 */
export function createSessionStore(initialSession: AppSession | null) {
  return createStore<SessionState>()((set) => ({
    session: initialSession,
    isPending: false,

    setSession: (session) => set({ session }),

    refetch: async () => {
      set({ isPending: true })
      const { data } = await authClient.getSession()
      const session = (data as AppSession | null) ?? null
      set({ session, isPending: false })
      return session
    },

    signOut: async () => {
      await authClient.signOut()
      set({ session: null })
    },
  }))
}
