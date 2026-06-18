"use client"

import { useConsentManager } from "@c15t/nextjs"
import posthog from "posthog-js"
import { useEffect, useRef } from "react"
import { useSession } from "@/lib/auth/session-provider"

/**
 * Bridges c15t consent ↔ PostHog. Mounted inside both the consent and session
 * providers. In consent-required regions (`consentRequired`), capturing follows
 * the `measurement` category and identify only runs once a User is both signed
 * in AND has consented (so we never attribute analytics without consent).
 * Elsewhere we capture — and identify signed-in users — by default. Re-runs if
 * consent is granted after login; on logout we reset.
 */
export function PostHogConsent({
  consentRequired,
}: {
  consentRequired: boolean
}) {
  const { has } = useConsentManager()
  const { data: session } = useSession()
  const measurement = has("measurement")
  const user = session?.user ?? null
  const identified = useRef<string | null>(null)

  // Capture by default; only gate on the `measurement` category where required.
  const canCapture = !consentRequired || measurement

  useEffect(() => {
    if (canCapture) {
      posthog.opt_in_capturing()
    } else {
      posthog.opt_out_capturing()
    }
  }, [canCapture])

  // Identify only while capturing is allowed + signed in; reset on logout.
  useEffect(() => {
    if (user && canCapture) {
      if (identified.current !== user.id) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.name,
          email_verified: user.emailVerified,
        })
        identified.current = user.id
      }
      return
    }
    if (!user && identified.current !== null) {
      posthog.reset()
      identified.current = null
    }
  }, [user, canCapture])

  return null
}
