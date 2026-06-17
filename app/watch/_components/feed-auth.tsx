"use client"

import { AuthButtons } from "@/components/auth/auth-buttons"

/**
 * Desktop-only auth control for the feed, pinned top-right. Hidden on mobile,
 * where the feed stays full-screen and auth lives in the header sheet.
 */
export function FeedAuth() {
  return (
    <div className="fixed top-3 right-3 z-50 hidden items-center gap-2 lg:flex">
      <AuthButtons variant="header" />
    </div>
  )
}
