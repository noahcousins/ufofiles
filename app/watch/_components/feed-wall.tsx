"use client"

import { useCallback } from "react"

interface FeedWallProps {
  /** Panel index in the feed, so the active-panel observer can see it. */
  index: number
  onOpen: () => void
  registerRef: (index: number, el: HTMLDivElement | null) => void
  /** Thumbnail of the next (withheld) video, blurred behind the copy. */
  thumbUrl: string | null
}

/**
 * The guest cut-off panel: snaps into place like a video, shows the next
 * video's thumbnail blurred out of reach, and offers one line back into the
 * sign-up modal. Nothing renders past it, so the feed simply ends here.
 */
export function FeedWall({
  index,
  onOpen,
  registerRef,
  thumbUrl,
}: FeedWallProps) {
  const ref = useCallback(
    (el: HTMLDivElement | null) => registerRef(index, el),
    [index, registerRef]
  )
  return (
    <div
      className="relative flex h-dvh snap-start snap-always items-center justify-center overflow-hidden bg-black"
      data-index={index}
      ref={ref}
    >
      {thumbUrl && (
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-center bg-cover opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${thumbUrl})` }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-black/40 via-black/70 to-black"
      />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <p className="font-mono text-lg text-white">Sign up to keep watching</p>
        <p className="max-w-xs text-balance font-mono text-sm text-white/50">
          Free account. Unlimited videos, plus a library for your saves and
          clips.
        </p>
        <button
          className="mt-3 h-11 w-full max-w-xs bg-white px-6 font-semibold text-black text-sm transition-colors hover:bg-white/90"
          onClick={onOpen}
          type="button"
        >
          Sign up free
        </button>
      </div>
    </div>
  )
}
