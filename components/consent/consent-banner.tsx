"use client"

import { useConsentManager } from "@c15t/nextjs"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckToggle } from "@/components/ui/check-toggle"

type View = "summary" | "customize"

/**
 * Floating cookie consent banner in our own UI (c15t is headless here — we only
 * use its hook). Shows until the User makes a choice. PostHog follows the
 * `measurement` category (PostHogConsent). Email-marketing consent is separate
 * and lives in account settings, not here.
 */
export function ConsentBanner() {
  // `activeUI` is the store-managed visibility signal c15t's own components use
  // ("banner" | "dialog" | "none"); saveConsents() flips it to "none". Gating on
  // hasConsented() doesn't reliably close the banner in offline mode.
  const { activeUI, saveConsents, setSelectedConsent, has } =
    useConsentManager()
  const [view, setView] = useState<View>("summary")
  const [measurement, setMeasurement] = useState(false)

  // Re-open always lands on the summary (footer "Cookie preferences" flips
  // activeUI back to "banner").
  useEffect(() => {
    if (activeUI === "banner") {
      setView("summary")
    }
  }, [activeUI])

  if (activeUI !== "banner") {
    return null
  }

  const openCustomize = () => {
    // Seed the toggles from the current saved choice.
    setMeasurement(has("measurement"))
    setView("customize")
  }

  const saveCustom = () => {
    setSelectedConsent("measurement", measurement)
    saveConsents("custom")
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-2xl border border-border bg-background/95 shadow-lg backdrop-blur-sm">
      {view === "summary" ? (
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs leading-relaxed">
            We use cookies for anonymous analytics to understand how the archive
            is used. Essential cookies always run.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button onClick={openCustomize} size="sm" variant="ghost">
              Customize
            </Button>
            <Button
              onClick={() => saveConsents("necessary")}
              size="sm"
              variant="outline"
            >
              Necessary only
            </Button>
            <Button onClick={() => saveConsents("all")} size="sm">
              Accept all
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-col divide-y divide-border">
            <ConsentToggle
              checked
              description="Required for the site to work. Always on."
              disabled
              label="Essential"
            />
            <ConsentToggle
              checked={measurement}
              description="Anonymous usage analytics to improve the archive."
              label="Analytics"
              onChange={setMeasurement}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => setView("summary")}
              size="sm"
              variant="ghost"
            >
              Back
            </Button>
            <Button onClick={saveCustom} size="sm">
              Save preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConsentToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="font-medium text-xs">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <CheckToggle
        checked={checked}
        disabled={disabled}
        label={label}
        onChange={onChange}
      />
    </div>
  )
}
