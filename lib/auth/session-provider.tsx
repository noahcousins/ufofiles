"use client"

import { createContext, useContext, useRef } from "react"
import { useStore } from "zustand"
import {
  type AppSession,
  createSessionStore,
  type SessionState,
  type SessionStore,
} from "./session-store"

const SessionStoreContext = createContext<SessionStore | null>(null)

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: AppSession | null
  children: React.ReactNode
}) {
  const storeRef = useRef<SessionStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createSessionStore(initialSession)
  }
  return (
    <SessionStoreContext.Provider value={storeRef.current}>
      {children}
    </SessionStoreContext.Provider>
  )
}

function useSessionStore<T>(selector: (state: SessionState) => T): T {
  const store = useContext(SessionStoreContext)
  if (!store) {
    throw new Error("useSession must be used within a <SessionProvider>")
  }
  return useStore(store, selector)
}

/**
 * Read the current session. Shaped like the old better-auth hook
 * (`{ data, isPending }`) so it's a drop-in replacement at call sites.
 */
export function useSession() {
  const data = useSessionStore((s) => s.session)
  const isPending = useSessionStore((s) => s.isPending)
  return { data, isPending }
}

/** Session mutations that need to write back into the store. */
export function useAuthActions() {
  const signOut = useSessionStore((s) => s.signOut)
  const refetch = useSessionStore((s) => s.refetch)
  const setSession = useSessionStore((s) => s.setSession)
  return { signOut, refetch, setSession }
}
