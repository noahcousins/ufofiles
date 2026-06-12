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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ensureGuestSession, useSession } from "@/lib/auth-client"
import { getStreamingVideoUrl, withDownloadParam } from "@/lib/file-url"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import type { FeedItem } from "./video-panel"

interface VideoActionsProps {
  item: FeedItem
}

export function VideoActions({ item }: VideoActionsProps) {
  const [copied, setCopied] = useState(false)
  const [clipTipOpen, setClipTipOpen] = useState(false)
  const { data: session } = useSession()
  const utils = trpc.useUtils()

  const bookmarkedIds = trpc.bookmarks.fileIds.useQuery(undefined, {
    enabled: Boolean(session),
  })
  const isBookmarked = bookmarkedIds.data?.includes(item.id) ?? false

  // Aggregate count across all users — public, cached. Only surfaced once a
  // video has real traction (see threshold below).
  const bookmarkCounts = trpc.bookmarks.counts.useQuery(
    { fileIds: [item.id] },
    { staleTime: 60 * 1000 }
  )
  const bookmarkCount = bookmarkCounts.data?.[item.id] ?? 0

  // Optimistically nudge the cached count so the number reacts instantly to the
  // user's own toggle, without waiting on the (server-cached) counts query.
  const bumpCount = (delta: number) => {
    utils.bookmarks.counts.setData({ fileIds: [item.id] }, (old) => ({
      ...old,
      [item.id]: Math.max(0, (old?.[item.id] ?? 0) + delta),
    }))
  }

  const createBookmark = trpc.bookmarks.create.useMutation({
    onSuccess: () => {
      utils.bookmarks.fileIds.invalidate()
      bumpCount(1)
    },
  })
  const removeBookmark = trpc.bookmarks.remove.useMutation({
    onSuccess: () => {
      utils.bookmarks.fileIds.invalidate()
      bumpCount(-1)
    },
  })
  const mutating = createBookmark.isPending || removeBookmark.isPending

  const handleBookmark = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (mutating) {
        return
      }
      // First mark on a fresh visitor silently mints a Guest (ADR-0003) — no
      // sign-up wall mid-scroll.
      await ensureGuestSession()
      if (isBookmarked) {
        removeBookmark.mutate({ fileId: item.id })
      } else {
        createBookmark.mutate({ fileId: item.id })
        posthog.capture("feed_video_bookmarked", { file_id: item.id })
      }
    },
    [isBookmarked, item.id, mutating, createBookmark, removeBookmark]
  )

  const copyLink = useCallback(() => {
    // Share into the feed (now at root), pinned to this video (reads `?v`).
    const url = new URL(`/?v=${item.id}`, window.location.origin)
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      posthog.capture("feed_video_shared", { file_id: item.id })
    })
  }, [item.id])

  // Clip isn't built yet — tapping just flashes a "coming soon" tooltip (so it
  // works on touch too, where hover never fires).
  const handleClipTease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setClipTipOpen(true)
    setTimeout(() => setClipTipOpen(false), 1500)
  }, [])

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

      <TooltipProvider delay={0}>
        <Tooltip onOpenChange={setClipTipOpen} open={clipTipOpen}>
          <TooltipTrigger
            onClick={handleClipTease}
            render={
              <ActionButton
                icon={<ScissorsIcon className="size-5" weight="fill" />}
                label="Clip"
              />
            }
          />
          <TooltipContent side="left">Coming soon</TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
                    href={`/files?fileId=${item.id}`}
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
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
          active ? "bg-white text-black" : "bg-black/40"
        )}
      >
        {icon}
      </div>
      <span className="font-mono text-[10px]">{label}</span>
    </button>
  )
}
