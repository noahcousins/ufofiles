"use client"

import { createStore } from "zustand/vanilla"
import { authClient } from "@/lib/auth-client"
import {
  type ClientSession,
  type FullSession,
  toClientSession,
} from "./client-session"

/**
 * The client-safe session shape (no token / ip / userAgent — see
 * `client-session.ts`). Named `AppSession` for back-compat with consumers.
 */
export type AppSession = ClientSession

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
      // Narrow to the client-safe shape so the token never lands in the store.
      const session = toClientSession((data as FullSession | null) ?? null)
      set({ session, isPending: false })
      return session
    },

    signOut: async () => {
      await authClient.signOut()
      set({ session: null })
    },
  }))
}
