"use client"

import { useConsentManager } from "@c15t/nextjs"
import posthog from "posthog-js"
import { useEffect, useRef } from "react"
import { useSession } from "@/lib/auth/session-provider"

/**
 * Bridges c15t consent ↔ PostHog. Mounted inside both the consent and session
 * providers. Capturing follows the `measurement` category; identify only runs
 * once a User is both signed in AND has consented (so we never attribute
 * analytics without consent), and re-runs if consent is granted after login.
 * On logout we reset.
 */
export function PostHogConsent() {
  const { has } = useConsentManager()
  const { data: session } = useSession()
  const measurement = has("measurement")
  const user = session?.user ?? null
  const identified = useRef<string | null>(null)

  // Gate all capture on analytics consent.
  useEffect(() => {
    if (measurement) {
      posthog.opt_in_capturing()
    } else {
      posthog.opt_out_capturing()
    }
  }, [measurement])

  // Identify only while consented + signed in; reset on logout.
  useEffect(() => {
    if (user && measurement) {
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
  }, [user, measurement])

  return null
}
