"use client"

import {
  ArrowSquareOutIcon,
  DownloadSimple,
  ShareNetworkIcon,
} from "@phosphor-icons/react"
import posthog from "posthog-js"
import { useCallback, useState } from "react"
import { getStreamingVideoUrl } from "@/lib/file-url"
import type { FeedItem } from "./video-panel"

interface VideoActionsProps {
  item: FeedItem
}

export function VideoActions({ item }: VideoActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const url = new URL(`/?fileId=${item.id}`, window.location.origin)
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        posthog.capture("feed_video_shared", { file_id: item.id })
      })
    },
    [item.id]
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

  return (
    <div className="absolute right-3 bottom-16 z-30 flex flex-col gap-4">
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
        onClick={handleShare}
      />

      <a
        download
        href={getStreamingVideoUrl(item.r2Key)}
        onClick={handleDownload}
      >
        <ActionButton
          icon={<DownloadSimple className="size-5" weight="fill" />}
          label="Save"
        />
      </a>

      <a href={`/?fileId=${item.id}`} onClick={(e) => e.stopPropagation()}>
        <ActionButton
          icon={<ArrowSquareOutIcon className="size-5" weight="fill" />}
          label="Details"
        />
      </a>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <button
      className="flex flex-col items-center gap-1 text-white/80 transition-colors hover:text-white"
      onClick={onClick}
      type="button"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
        {icon}
      </div>
      <span className="font-mono text-[10px]">{label}</span>
    </button>
  )
}
