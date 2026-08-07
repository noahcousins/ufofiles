"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * The App Router exposes `router.back()` but nothing that says whether going
 * back stays on the site — there's no history depth, no referrer, and no
 * route-change events. So we count soft navigations ourselves.
 *
 * Module scope, not context: this is read imperatively from event handlers and
 * never needs to trigger a re-render. It resets on a hard load, which is
 * exactly right — a fresh document means a fresh (empty) in-app history.
 */
let softNavCount = 0

/** True once the user has made at least one in-app navigation this page load. */
export function canGoBackInApp(): boolean {
  return softNavCount > 0
}

/** Mount once, app-wide. Renders nothing. */
export function NavigationTracker() {
  const pathname = usePathname()
  const lastPathname = useRef<string | null>(null)

  useEffect(() => {
    // Compare against the last seen path rather than counting effect runs: the
    // first run is the arrival, not a navigation, and StrictMode's double
    // invoke in dev would otherwise register as one.
    if (lastPathname.current !== null && lastPathname.current !== pathname) {
      softNavCount++
    }
    lastPathname.current = pathname
  }, [pathname])

  return null
}
