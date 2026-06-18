"use client"

import { ConsentManagerProvider } from "@c15t/nextjs"
import { ConsentBanner } from "./consent-banner"
import { PostHogConsent } from "./posthog-consent"

/**
 * App-wide consent context (c15t) in **offline mode** — consent lives in the
 * browser, no backend. Renders our own banner + the PostHog bridge. Mounted
 * high in the tree so the footer's "Cookie preferences" and the PostHog bridge
 * can read consent.
 *
 * `consentRequired` is geo-derived (see lib/consent/geo.ts): only EU/EEA/UK/CH
 * visitors see the banner and have capture gated on consent. Elsewhere we
 * capture by default and skip the banner.
 */
export function ConsentProvider({
  consentRequired,
  children,
}: {
  consentRequired: boolean
  children: React.ReactNode
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
      }}
    >
      {children}
      {consentRequired && <ConsentBanner />}
      <PostHogConsent consentRequired={consentRequired} />
    </ConsentManagerProvider>
  )
}
