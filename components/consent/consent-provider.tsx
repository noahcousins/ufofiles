"use client"

import { ConsentManagerProvider } from "@c15t/nextjs"
import { ConsentBanner } from "./consent-banner"
import { PostHogConsent } from "./posthog-consent"

/**
 * App-wide consent context (c15t) in **offline mode** — consent lives in the
 * browser, no backend. Renders our own banner + the PostHog bridge. Mounted
 * high in the tree so the footer's "Cookie preferences" and the PostHog bridge
 * can read consent.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
      }}
    >
      {children}
      <ConsentBanner />
      <PostHogConsent />
    </ConsentManagerProvider>
  )
}
