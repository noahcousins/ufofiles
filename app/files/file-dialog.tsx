"use client"

import {
  ArrowSquareOutIcon,
  Pause,
  Play,
  ShareNetworkIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import posthog from "posthog-js"
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HotIndicator } from "@/components/ui/hot-indicator"
import {
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  useMorphingDialog,
} from "@/components/ui/morphing-dialog"
import { getFileUrl } from "@/lib/file-url"
import {
  type FileItem,
  formatFileSize,
  formatMimeLabel,
  TYPE_COLORS,
  TYPE_ICONS,
  type ViewData,
} from "./file-card"
import { AgencySeal } from "./file-filters"

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function DialogVideoPlayer({ r2Key }: { r2Key: string }) {
  const { isOpen } = useMorphingDialog()
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    if (isOpen) {
      v.play().catch(() => {
        // no-op
      })
    } else {
      v.pause()
      v.currentTime = 0
      setPlaying(false)
    }
  }, [isOpen])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current
      if (!v) {
        return
      }
      const val = Number.parseFloat(e.target.value)
      v.volume = val
      setVolume(val)
      if (val === 0) {
        v.muted = true
        setMuted(true)
      } else if (v.muted) {
        v.muted = false
        setMuted(false)
      }
    },
    []
  )

  const draggingRef = useRef(false)
  const [dragPct, setDragPct] = useState<number | null>(null)

  const pctFromX = useCallback((clientX: number) => {
    const bar = progressRef.current
    if (!bar) {
      return 0
    }
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const handleProgressDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      draggingRef.current = true
      setDragPct(pctFromX(e.clientX))
    },
    [pctFromX]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      draggingRef.current = true
      setDragPct(pctFromX(e.touches[0].clientX))
    },
    [pctFromX]
  )

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) {
        return
      }
      e.preventDefault()
      setDragPct(pctFromX(e.clientX))
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) {
        return
      }
      setDragPct(pctFromX(e.touches[0].clientX))
    }
    const commit = (finalPct: number) => {
      draggingRef.current = false
      const v = videoRef.current
      if (v && duration) {
        v.currentTime = finalPct * duration
        setCurrentTime(finalPct * duration)
      }
      setDragPct(null)
    }
    const handleUp = (e: MouseEvent) => {
      if (!draggingRef.current) {
        return
      }
      commit(pctFromX(e.clientX))
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (!draggingRef.current) {
        return
      }
      const touch = e.changedTouches[0]
      commit(touch ? pctFromX(touch.clientX) : 0)
    }

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleTouchEnd)
    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [pctFromX, duration])

  const src = getFileUrl(r2Key)
  const realPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const pct = dragPct === null ? realPct : dragPct * 100

  return (
    <div className="relative bg-black">
      <video
        className="w-full"
        onClick={togglePlay}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        playsInline
        ref={videoRef}
        src={src}
      />

      {!playing && (
        <button
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
          onClick={togglePlay}
          type="button"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm dark:bg-white/80">
            <Play className="size-7 text-black" weight="fill" />
          </div>
        </button>
      )}

      <div className="flex items-center gap-2 bg-black/80 px-3 py-2 backdrop-blur-sm">
        <button
          className="shrink-0 text-white/80 hover:text-white"
          onClick={togglePlay}
          type="button"
        >
          {playing ? (
            <Pause className="size-4" weight="fill" />
          ) : (
            <Play className="size-4" weight="fill" />
          )}
        </button>

        <span className="shrink-0 text-[11px] text-white/60 tabular-nums">
          {formatTime(dragPct === null ? currentTime : dragPct * duration)}
        </span>

        <div
          className="group relative flex h-5 flex-1 cursor-pointer touch-none select-none items-center"
          onMouseDown={handleProgressDown}
          onTouchStart={handleTouchStart}
          ref={progressRef}
        >
          <div className="h-1 w-full rounded-full bg-white/20 transition-[height] group-hover:h-1.5">
            <div
              className="relative h-full rounded-full bg-white/80"
              style={{ width: `${pct}%` }}
            >
              <span className="absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        </div>

        <span className="shrink-0 text-[11px] text-white/60 tabular-nums">
          {formatTime(duration)}
        </span>

        <button
          className="shrink-0 text-white/80 hover:text-white"
          onClick={toggleMute}
        >
          {muted || volume === 0 ? (
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M5.586 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m17 14-4-4m0 4 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M15.536 8.464a5 5 0 0 1 0 7.072M17.95 6.05a8 8 0 0 1 0 11.9M5.586 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <input
          className="h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          max={1}
          min={0}
          onChange={handleVolumeChange}
          step={0.05}
          type="range"
          value={muted ? 0 : volume}
        />
      </div>
    </div>
  )
}

function ShareButton({ fileId }: { fileId: number }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const url = new URL(window.location.href)
      url.searchParams.set("fileId", String(fileId))
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        posthog.capture("file_shared", { file_id: fileId })
      })
    },
    [fileId]
  )

  return (
    <Button
      className="ml-auto gap-1.5"
      onClick={handleCopy}
      size="lg"
      variant="outline"
    >
      {copied ? (
        <>
          <svg
            className="size-3.5"
            fill="none"
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
          Copied
        </>
      ) : (
        <>
          <ShareNetworkIcon className="size-3.5" />
          Share
        </>
      )}
    </Button>
  )
}

const DESCRIPTION_LIMIT = 200

function DescriptionWithExpand({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = description.length > DESCRIPTION_LIMIT

  return (
    <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
      {needsTruncation && !expanded
        ? description.slice(0, DESCRIPTION_LIMIT)
        : description}
      {needsTruncation && !expanded && (
        <>
          ...{" "}
          <button
            className="font-medium text-foreground/70 text-xs underline underline-offset-2 transition-colors hover:no-underline"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
          >
            Show more
          </button>
        </>
      )}
      {needsTruncation && expanded && (
        <>
          {" "}
          <button
            className="font-medium text-foreground/70 text-xs underline underline-offset-2 transition-colors hover:no-underline"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(false)
            }}
          >
            Show less
          </button>
        </>
      )}
    </p>
  )
}

export function FileDialog({
  file,
  viewData,
  previewSrc,
  category,
  fileUrl,
}: {
  file: FileItem
  viewData?: ViewData
  previewSrc: string | null
  category: "PDF" | "VID" | "IMG"
  fileUrl: string
}) {
  return (
    <MorphingDialogContainer>
      <MorphingDialogContent className="relative max-h-[85vh] w-[90vw] max-w-lg overflow-hidden border border-border bg-card">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <div className="relative shrink-0">
            {category === "VID" && file.r2Key ? (
              <DialogVideoPlayer r2Key={file.r2Key} />
            ) : previewSrc ? (
              <Link href={fileUrl} onClick={(e) => e.stopPropagation()}>
                <MorphingDialogImage
                  alt={file.title}
                  className="max-h-[50vh] w-full cursor-pointer bg-black/10 object-contain transition-opacity hover:opacity-90"
                  src={previewSrc}
                />
              </Link>
            ) : (
              <Link
                className="flex h-48 w-full items-center justify-center bg-muted/30 transition-colors hover:bg-muted/50"
                href={fileUrl}
                onClick={(e) => e.stopPropagation()}
              >
                {TYPE_ICONS[category] ?? TYPE_ICONS.PDF}
              </Link>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-3">
            <MorphingDialogTitle className="break-words font-semibold text-base leading-snug">
              {file.title}
            </MorphingDialogTitle>

            <MorphingDialogSubtitle className="mt-1.5 flex flex-wrap items-center gap-2">
              {file.agency && (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <AgencySeal agency={file.agency} />
                  {file.agency}
                </span>
              )}
              <Badge
                className={`font-mono text-[10px] tracking-tighter ${TYPE_COLORS[category] ?? ""}`}
                variant="outline"
              >
                {formatMimeLabel(file.mimeType)}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {formatFileSize(file.fileSize)}
              </span>
              {viewData && (
                <span className="ml-auto">
                  <HotIndicator
                    hotScore={viewData.hotScore}
                    recentViews={viewData.recentViews}
                    views={viewData.views}
                  />
                </span>
              )}
            </MorphingDialogSubtitle>

            {(file.incidentDate || file.incidentLocation) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                {file.incidentDate && file.incidentDate !== "N/A" && (
                  <span>
                    <span className="font-medium text-foreground/70">
                      Date:
                    </span>{" "}
                    {file.incidentDate}
                  </span>
                )}
                {file.incidentLocation && file.incidentLocation !== "N/A" && (
                  <span>
                    <span className="font-medium text-foreground/70">
                      Location:
                    </span>{" "}
                    {file.incidentLocation}
                  </span>
                )}
              </div>
            )}

            {file.description && (
              <DescriptionWithExpand description={file.description} />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-border border-t px-5 py-3">
            {file.r2Key && (
              <a
                download
                href={getFileUrl(file.r2Key)}
                onClick={(e) => {
                  e.stopPropagation()
                  posthog.capture("file_downloaded", {
                    file_id: file.id,
                    file_title: file.title,
                    file_agency: file.agency,
                    file_type: file.mimeType,
                  })
                }}
              >
                <Button size="lg" variant="default">
                  Download
                </Button>
              </a>
            )}
            {file.documentUrl && (
              <a
                href={file.documentUrl}
                onClick={(e) => {
                  e.stopPropagation()
                  posthog.capture("file_source_opened", {
                    file_id: file.id,
                    file_title: file.title,
                    file_agency: file.agency,
                  })
                }}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Button className="gap-1.5" size="sm" variant="ghost">
                  <ArrowSquareOutIcon className="size-3.5" />
                  Source
                </Button>
              </a>
            )}
            <ShareButton fileId={file.id} />
          </div>
        </div>

        <MorphingDialogClose className="text-muted-foreground hover:text-foreground" />
      </MorphingDialogContent>
    </MorphingDialogContainer>
  )
}
