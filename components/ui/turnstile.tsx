"use client"

import { useEffect, useRef } from "react"

interface TurnstileApi {
  remove: (id: string) => void
  render: (
    el: HTMLElement,
    opts: {
      callback: (token: string) => void
      "error-callback"?: () => void
      "expired-callback"?: () => void
      sitekey: string
      size?: "normal" | "flexible" | "compact"
      theme?: "auto" | "light" | "dark"
    }
  ) => string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

/**
 * Cloudflare Turnstile widget. Calls `onToken` with a verification token (or
 * null when it expires/errors). Self-loads the Turnstile script once.
 */
export function Turnstile({
  siteKey,
  onToken,
  className,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false

    const renderWidget = () => {
      if (cancelled || !(containerRef.current && window.turnstile)) {
        return
      }
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
        theme: "dark",
        size: "flexible",
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        "script[data-turnstile]"
      )
      if (existing) {
        existing.addEventListener("load", renderWidget)
      } else {
        const script = document.createElement("script")
        script.src = SCRIPT_SRC
        script.async = true
        script.defer = true
        script.dataset.turnstile = "true"
        script.addEventListener("load", renderWidget)
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId)
      }
    }
  }, [siteKey])

  return <div className={className} ref={containerRef} />
}
