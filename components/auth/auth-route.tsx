"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { safeInternalPath } from "@/lib/safe-path"
import { DEFAULT_AUTH_REDIRECT } from "./auth-types"

/**
 * Renders the shared auth modal as a standalone route (`/login`, `/signup`).
 * Middleware bounces logged-out visitors of protected pages here with a
 * `?redirect=` back to where they were headed; dismissing the modal returns
 * them home.
 */
export function AuthRoute({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(true)

  return (
    <AuthDialog
      callbackURL={safeInternalPath(
        params.get("redirect"),
        DEFAULT_AUTH_REDIRECT
      )}
      initialMode={mode}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          router.push("/")
        }
      }}
      open={open}
    />
  )
}
