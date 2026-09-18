"use client"

import posthog from "posthog-js"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { useSession } from "@/lib/auth/session-provider"

/**
 * Guests get this many videos per feed, then a wall panel. Mirrors the file
 * browser's GUEST_FILE_LIMIT, sized for the feed.
 */
export const GUEST_VIDEO_LIMIT = 5

/**
 * State for the feed's guest gate: whether the wall applies, and the sign-up
 * modal that opens when the wall panel becomes active. Edge-triggered on the
 * active index — it fires on arrival at the wall and re-arms once the guest
 * swipes back up, so dismissing the modal doesn't reopen it in place.
 */
export function useGuestWall(activeIndex: number, totalVideos: number | null) {
  const { data: session, isPending: sessionPending } = useSession()
  const openAuth = useAuthDialog()
  const isGuest = !(session || sessionPending)
  const guestWall =
    isGuest && totalVideos !== null && totalVideos > GUEST_VIDEO_LIMIT

  const [upsellOpen, setUpsellOpen] = useState(false)
  const armedRef = useRef(true)

  useEffect(() => {
    if (!guestWall) {
      return
    }
    if (activeIndex < GUEST_VIDEO_LIMIT) {
      armedRef.current = true
      return
    }
    if (activeIndex === GUEST_VIDEO_LIMIT && armedRef.current) {
      armedRef.current = false
      posthog.capture("scroll_upsell_shown", {
        source: "feed",
        videos_seen: GUEST_VIDEO_LIMIT,
      })
      setUpsellOpen(true)
    }
  }, [activeIndex, guestWall])

  /** The wall panel's own button: open the modal without re-arming. */
  const openFromWall = useCallback(() => {
    armedRef.current = false
    posthog.capture("scroll_upsell_shown", {
      source: "feed_wall",
      videos_seen: GUEST_VIDEO_LIMIT,
    })
    setUpsellOpen(true)
  }, [])

  /** Modal CTA: hand off to the global auth dialog. */
  const openAuthFromUpsell = useCallback(
    (mode: "signin" | "signup") => {
      posthog.capture("scroll_upsell_clicked", { mode, surface: "feed" })
      setUpsellOpen(false)
      openAuth(mode, undefined, "unlimited")
    },
    [openAuth]
  )

  return {
    guestWall,
    upsellOpen,
    setUpsellOpen,
    openFromWall,
    openAuthFromUpsell,
  }
}
