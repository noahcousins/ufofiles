import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "", {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  person_profiles: "identified_only",
  // Consent gating (c15t): don't write cookies/storage until measurement
  // consent is granted; PostHogConsent flips opt-in/out on the c15t signal.
  cookieless_mode: "on_reject",
})

// Stay opted out until c15t confirms measurement consent (see PostHogConsent).
posthog.opt_out_capturing()
