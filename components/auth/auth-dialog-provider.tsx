"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { currentRelativePath } from "@/lib/safe-path"
import { AuthDialog } from "./auth-dialog"
import type { AuthMode } from "./auth-types"

/**
 * Open the auth modal from anywhere in the app. `callbackURL` defaults to the
 * current page (captured at click time) so sign-in returns the user exactly
 * where they were — path and query. Sibling to EmailVerificationProvider /
 * useRequireVerified: the dialog is rendered once, globally, and triggers (the
 * header, the bookmark/clip gates) just call `open()` instead of each owning a
 * dialog + open-state.
 */
type OpenAuth = (mode: AuthMode, callbackURL?: string) => void

const AuthDialogContext = createContext<OpenAuth | null>(null)

export function AuthDialogProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>("signup")
  const [callbackURL, setCallbackURL] = useState<string>()

  const openAuth = useCallback<OpenAuth>((nextMode, dest) => {
    setMode(nextMode)
    setCallbackURL(dest ?? currentRelativePath())
    setOpen(true)
  }, [])

  return (
    <AuthDialogContext.Provider value={openAuth}>
      {children}
      <AuthDialog
        callbackURL={callbackURL}
        initialMode={mode}
        onOpenChange={setOpen}
        open={open}
      />
    </AuthDialogContext.Provider>
  )
}

export function useAuthDialog(): OpenAuth {
  const ctx = useContext(AuthDialogContext)
  if (!ctx) {
    throw new Error("useAuthDialog must be used within <AuthDialogProvider>")
  }
  return ctx
}
