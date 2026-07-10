"use client"

import { Popover } from "@base-ui/react/popover"
import NumberFlow from "@number-flow/react"
import {
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  DownloadSimple,
  LinkSimpleIcon,
  ScissorsIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react"
import posthog from "posthog-js"
import { useCallback, useState } from "react"
import { useSession } from "@/lib/auth/session-provider"
import { useBookmark } from "@/lib/bookmarks/use-bookmark"
import { getStreamingVideoUrl, withDownloadParam } from "@/lib/file-url"
import { cn } from "@/lib/utils"
import type { FeedItem } from "./video-panel"

interface VideoActionsProps {
  item: FeedItem
  onStartClip: () => void
}

export function VideoActions({ item, onStartClip }: VideoActionsProps) {
  const [copied, setCopied] = useState(false)
  const { data: session } = useSession()
  const {
    isBookmarked,
    bookmarkCount,
    toggle: toggleBookmark,
    mutating,
  } = useBookmark(item.id, item.bookmarkCount)

  const handleBookmark = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // Count an add only — toggle() no-ops into the auth modal when signed out.
      if (session && !(isBookmarked || mutating)) {
        posthog.capture("feed_video_bookmarked", { file_id: item.id })
      }
      toggleBookmark()
    },
    [session, isBookmarked, mutating, item.id, toggleBookmark]
  )

  const copyLink = useCallback(() => {
    // Share into the feed (at /watch), pinned to this video (reads `?v`).
    const url = new URL(`/watch?v=${item.id}`, window.location.origin)
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      posthog.capture("feed_video_shared", { file_id: item.id })
    })
  }, [item.id])

  // Enter the clip editor (takeover mode owned by video-panel). Gating to a
  // Member happens at commit, not here — taste-then-convert (ADR-0003).
  const handleClip = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onStartClip()
      posthog.capture("feed_clip_started", { file_id: item.id })
    },
    [onStartClip, item.id]
  )

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      posthog.capture("feed_video_downloaded", {
        file_id: item.id,
        file_title: item.title,
      })
    },
    [item.id, item.title]
  )

  if (!item.r2Key) {
    return null
  }

  // Hide the count until a video has real traction (> 10); below that, show the
  // toggle word instead.
  let bookmarkLabel: React.ReactNode = isBookmarked ? "Saved" : "Bookmark"
  if (bookmarkCount > 10) {
    bookmarkLabel = (
      <NumberFlow format={{ notation: "compact" }} value={bookmarkCount} />
    )
  }

  const downloadHref = withDownloadParam(getStreamingVideoUrl(item.r2Key))

  return (
    <div className="absolute right-3 bottom-16 z-30 flex w-16 flex-col items-center gap-4">
      <ActionButton
        active={isBookmarked}
        icon={
          <BookmarkSimpleIcon
            className="size-5"
            weight={isBookmarked ? "fill" : "regular"}
          />
        }
        label={bookmarkLabel}
        onClick={handleBookmark}
      />

      <ActionButton
        icon={<ScissorsIcon className="size-5" weight="fill" />}
        label="Clip"
        onClick={handleClip}
      />

      <Popover.Root>
        <Popover.Trigger
          onClick={(e) => e.stopPropagation()}
          render={
            <ActionButton
              icon={
                copied ? (
                  <svg
                    aria-label="Copied"
                    className="size-5"
                    fill="none"
                    role="img"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4.5 12.75l6 6 9-13.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <ShareNetworkIcon className="size-5" weight="fill" />
                )
              }
              label={copied ? "Copied" : "Share"}
            />
          }
        />
        <Popover.Portal>
          <Popover.Positioner
            align="center"
            className="isolate z-50"
            side="left"
            sideOffset={6}
          >
            <Popover.Popup className="data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 min-w-36 origin-(--transform-origin) overflow-hidden rounded-none bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in">
              <Popover.Close
                render={
                  <button
                    className="flex w-full cursor-default select-none items-center gap-2 rounded-none py-2 pr-8 pl-2 text-xs outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={copyLink}
                    type="button"
                  >
                    <LinkSimpleIcon className="size-4" weight="bold" />
                    Copy link
                  </button>
                }
              />
              <Popover.Close
                render={
                  <a
                    className="flex w-full cursor-default select-none items-center gap-2 rounded-none py-2 pr-8 pl-2 text-xs outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
                    download
                    href={downloadHref}
                    onClick={handleDownload}
                  >
                    <DownloadSimple className="size-4" weight="fill" />
                    Save
                  </a>
                }
              />
              <Popover.Close
                render={
                  <a
                    className="flex w-full cursor-default select-none items-center gap-2 rounded-none py-2 pr-8 pl-2 text-xs outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
                    href={`/?fileId=${item.id}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ArrowSquareOutIcon className="size-4" weight="fill" />
                    Details
                  </a>
                }
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

function ActionButton({
  active,
  icon,
  label,
  className,
  ...rest
}: {
  active?: boolean
  icon: React.ReactNode
  label: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex flex-col items-center gap-1 text-white/80 transition-colors hover:text-white",
        className
      )}
      type="button"
      {...rest}
    >
      {/* No transition on the active state: the background/color must flip in
          sync with the icon weight and label text, which swap instantly. */}
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full backdrop-blur-sm",
          active ? "bg-white text-black" : "bg-black/40"
        )}
      >
        {icon}
      </div>
      <span className="font-mono text-[10px]">{label}</span>
    </button>
  )
}
