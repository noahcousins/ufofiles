import posthog from "posthog-js"

const SENSITIVE_URL_PARAMS = ["token", "otp", "code", "error"]
const URL_PROPS = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
]

function redactSensitiveUrlParams(url: string): string {
  try {
    const u = new URL(url)
    let changed = false
    for (const param of SENSITIVE_URL_PARAMS) {
      if (u.searchParams.has(param)) {
        u.searchParams.set(param, "redacted")
        changed = true
      }
    }
    return changed ? u.toString() : url
  } catch {
    return url
  }
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "", {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  person_profiles: "identified_only",
  // Consent gating (c15t): don't write cookies/storage until measurement
  // consent is granted; PostHogConsent flips opt-in/out on the c15t signal.
  cookieless_mode: "on_reject",
  before_send: (event) => {
    if (event?.properties) {
      for (const prop of URL_PROPS) {
        const value = event.properties[prop]
        if (typeof value === "string") {
          event.properties[prop] = redactSensitiveUrlParams(value)
        }
      }
    }
    return event
  },
})

// Stay opted out until c15t confirms measurement consent (see PostHogConsent).
posthog.opt_out_capturing()
