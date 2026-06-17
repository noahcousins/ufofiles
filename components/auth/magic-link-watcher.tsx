"use client"

import { useEffect } from "react"
import { authClient } from "@/lib/auth-client"
import { navigateInternal } from "@/lib/safe-path"
import { DEFAULT_AUTH_REDIRECT } from "./auth-types"

/**
 * Renders nothing — drives the magic-link "this tab updates itself" behaviour.
 * While the "check your email" step is up, the user clicks the link in another
 * tab (which sets the shared session cookie); we poll (and re-check on
 * focus/visibility) and land them the instant a session appears. Only mounted on
 * the magicSent step, so the effect's lifetime IS that window.
 */
export function MagicLinkWatcher({ callbackURL }: { callbackURL: string }) {
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data } = await authClient.getSession()
      if (!cancelled && data?.user) {
        cancelled = true
        navigateInternal(callbackURL, DEFAULT_AUTH_REDIRECT)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check()
      }
    }
    const id = setInterval(check, 2500)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", check)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", check)
    }
  }, [callbackURL])

  return null
}
