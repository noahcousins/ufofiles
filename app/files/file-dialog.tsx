"use client"

import {
  ArrowSquareOutIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CornersInIcon,
  CornersOutIcon,
  FileTextIcon,
  Pause,
  Play,
  ShareNetworkIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import posthog from "posthog-js"
import type React from "react"
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
import { getFileUrl, getStreamingVideoUrl } from "@/lib/file-url"
import { cn, formatFileSize } from "@/lib/utils"
import {
  type FileItem,
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

function DialogVideoPlayer({
  r2Key,
  poster,
}: {
  r2Key: string
  poster?: string | null
}) {
  const { isOpen } = useMorphingDialog()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    const v = videoRef.current

    // Standard Fullscreen API (desktop browsers, Android, iPad)
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }
    if (el?.requestFullscreen) {
      el.requestFullscreen()
      return
    }

    // iOS Safari - only supports fullscreen on the <video> element itself
    if (v && "webkitEnterFullscreen" in v) {
      ;(
        v as HTMLVideoElement & { webkitEnterFullscreen: () => void }
      ).webkitEnterFullscreen()
    }
  }, [])

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleChange)

    // iOS fires events on the video element when entering/exiting native fullscreen
    const v = videoRef.current
    const onBegin = () => setIsFullscreen(true)
    const onEnd = () => setIsFullscreen(false)
    v?.addEventListener("webkitbeginfullscreen", onBegin)
    v?.addEventListener("webkitendfullscreen", onEnd)

    return () => {
      document.removeEventListener("fullscreenchange", handleChange)
      v?.removeEventListener("webkitbeginfullscreen", onBegin)
      v?.removeEventListener("webkitendfullscreen", onEnd)
    }
  }, [])

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

  const src = getStreamingVideoUrl(r2Key)
  const realPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const pct = dragPct === null ? realPct : dragPct * 100

  return (
    <div
      className={cn(
        "relative bg-black",
        isFullscreen && "flex h-screen flex-col"
      )}
      ref={containerRef}
    >
      <video
        className={cn(
          "aspect-video w-full",
          isFullscreen && "flex-1 object-contain"
        )}
        onClick={togglePlay}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        playsInline
        poster={poster ?? undefined}
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

        <button
          className="shrink-0 text-white/80 hover:text-white"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          type="button"
        >
          {isFullscreen ? (
            <CornersInIcon className="size-4" />
          ) : (
            <CornersOutIcon className="size-4" />
          )}
        </button>
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
          Share this file
        </>
      )}
    </Button>
  )
}

/**
 * Determines whether the close button (top-right corner) sits on a light or
 * dark area. Accounts for `object-contain` - when the rendered image doesn't
 * reach the right edge of its element (portrait docs), the X sits on the
 * container background instead, so we fall back to theme-aware defaults.
 */
function usePreviewLuminance(
  src: string | null,
  isOpen: boolean,
  category: "PDF" | "VID" | "IMG",
  previewRef: React.RefObject<HTMLDivElement | null>
): "light" | "dark" | null {
  const [luminance, setLuminance] = useState<"light" | "dark" | null>(null)

  useEffect(() => {
    if (category === "VID") {
      setLuminance(isOpen ? "dark" : null)
      return
    }

    if (!(isOpen && src)) {
      setLuminance(null)
      return
    }

    // Wait a frame so layout is settled and the img element is measurable
    const raf = requestAnimationFrame(() => {
      const container = previewRef.current
      if (!container) {
        setLuminance(null)
        return
      }

      const imgEl = container.querySelector("img")
      if (!imgEl) {
        setLuminance(null)
        return
      }

      const analyze = () => {
        const nw = imgEl.naturalWidth
        const nh = imgEl.naturalHeight
        if (!(nw && nh)) {
          setLuminance(null)
          return
        }

        // Compute where the image content actually renders (object-contain)
        const elRect = imgEl.getBoundingClientRect()
        const ew = elRect.width
        const eh = elRect.height
        const scale = Math.min(ew / nw, eh / nh)
        const renderedW = nw * scale
        const offsetX = (ew - renderedW) / 2

        // Close button sits at right-6 (24px) from the dialog edge, icon 24×24
        // Its left edge relative to the preview container ≈ ew - 48
        const xBtnLeft = ew - 48
        const imageRight = offsetX + renderedW

        if (xBtnLeft >= imageRight) {
          // X is in the pillarbox gap, not over image content → use theme default
          setLuminance(null)
          return
        }

        // X is over the image - sample the corresponding region
        const probe = new Image()
        probe.crossOrigin = "anonymous"
        probe.onload = () => {
          try {
            const canvas = document.createElement("canvas")
            const size = 60
            canvas.width = size
            canvas.height = size
            const ctx = canvas.getContext("2d")
            if (!ctx) {
              setLuminance(null)
              return
            }

            // Map X button position back to source image coordinates
            const srcX = Math.max(
              0,
              Math.round(((xBtnLeft - offsetX) / renderedW) * nw)
            )
            const sw = Math.min(Math.round((48 / renderedW) * nw), nw - srcX)
            const sh = Math.min(Math.round((48 / (nh * scale)) * nh), nh)
            ctx.drawImage(probe, srcX, 0, sw, sh, 0, 0, size, size)

            const data = ctx.getImageData(0, 0, size, size).data
            let totalLum = 0
            const pixelCount = data.length / 4
            for (let i = 0; i < data.length; i += 4) {
              totalLum +=
                0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
            }
            setLuminance(totalLum / pixelCount / 255 < 0.5 ? "dark" : "light")
          } catch {
            setLuminance(null)
          }
        }
        probe.onerror = () => setLuminance(null)
        probe.src = src!
      }

      if (imgEl.complete && imgEl.naturalWidth > 0) {
        analyze()
      } else {
        imgEl.addEventListener("load", analyze, { once: true })
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [src, isOpen, category, previewRef])

  return luminance
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

function ProgressiveDialogImage({
  alt,
  src,
  thumbSrc,
}: {
  alt: string
  src: string
  thumbSrc?: string | null
}) {
  const { isOpen } = useMorphingDialog()
  const [loaded, setLoaded] = useState(false)
  const [animationDone, setAnimationDone] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setAnimationDone(false)
      return
    }
    const timer = setTimeout(() => setAnimationDone(true), 400)
    return () => clearTimeout(timer)
  }, [isOpen])

  if (!thumbSrc) {
    return (
      <MorphingDialogImage
        alt={alt}
        className="max-h-[50vh] w-full cursor-pointer bg-black/10 object-contain"
        src={src}
      />
    )
  }

  return (
    <div className="relative overflow-hidden">
      <MorphingDialogImage
        alt={alt}
        className={cn(
          "max-h-[50vh] w-full cursor-pointer bg-black/10 object-contain",
          !loaded && "blur-[2px]"
        )}
        src={thumbSrc}
      />
      {animationDone && (
        <img
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full cursor-pointer object-contain transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          src={src}
        />
      )}
    </div>
  )
}

export function FileDialog({
  file,
  viewData,
  previewSrc,
  thumbSrc,
  category,
  fileUrl,
  onNavigate,
  prevFileId,
  nextFileId,
  currentIndex,
  totalFiles,
}: {
  file: FileItem
  viewData?: ViewData
  previewSrc: string | null
  thumbSrc?: string | null
  category: "PDF" | "VID" | "IMG"
  fileUrl: string
  onNavigate: (fileId: number) => void
  prevFileId: number | null
  nextFileId: number | null
  currentIndex: number
  totalFiles: number
}) {
  const { isOpen } = useMorphingDialog()

  const stableOnNavigate = useRef(onNavigate)
  stableOnNavigate.current = onNavigate
  const stablePrev = useRef(prevFileId)
  stablePrev.current = prevFileId
  const stableNext = useRef(nextFileId)
  stableNext.current = nextFileId

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (e.key === "ArrowLeft" && stablePrev.current != null) {
        e.preventDefault()
        stableOnNavigate.current(stablePrev.current)
      } else if (e.key === "ArrowRight" && stableNext.current != null) {
        e.preventDefault()
        stableOnNavigate.current(stableNext.current)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const hasNav = totalFiles > 1
  const previewRef = useRef<HTMLDivElement>(null)
  const luminance = usePreviewLuminance(
    previewSrc,
    isOpen,
    category,
    previewRef
  )

  return (
    <MorphingDialogContainer>
      <MorphingDialogContent className="relative max-h-[85vh] w-[90vw] max-w-lg overflow-hidden border border-border bg-card">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          {hasNav && (
            <div className="flex shrink-0 items-center justify-between border-border border-b px-3 py-1.5">
              <Button
                className="gap-1"
                disabled={prevFileId == null}
                onClick={(e) => {
                  e.stopPropagation()
                  if (prevFileId != null) {
                    posthog.capture("file_dialog_navigated", {
                      direction: "prev",
                      file_id: prevFileId,
                    })
                    onNavigate(prevFileId)
                  }
                }}
                size="sm"
                variant="ghost"
              >
                <CaretLeftIcon className="size-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {currentIndex + 1}/{totalFiles}
              </span>
              <Button
                className="gap-1"
                disabled={nextFileId == null}
                onClick={(e) => {
                  e.stopPropagation()
                  if (nextFileId != null) {
                    posthog.capture("file_dialog_navigated", {
                      direction: "next",
                      file_id: nextFileId,
                    })
                    onNavigate(nextFileId)
                  }
                }}
                size="sm"
                variant="ghost"
              >
                <span className="hidden sm:inline">Next</span>
                <CaretRightIcon className="size-3.5" />
              </Button>
            </div>
          )}

          <div className="relative shrink-0" ref={previewRef}>
            {category === "VID" && file.r2Key ? (
              <DialogVideoPlayer poster={previewSrc} r2Key={file.r2Key} />
            ) : previewSrc ? (
              <Link href={fileUrl} onClick={(e) => e.stopPropagation()}>
                <ProgressiveDialogImage
                  alt={file.title}
                  src={previewSrc}
                  thumbSrc={thumbSrc}
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-3">
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
            {file.transcriptR2Key && (
              <a
                download
                href={getFileUrl(file.transcriptR2Key)}
                onClick={(e) => {
                  e.stopPropagation()
                  posthog.capture("transcript_downloaded", {
                    file_id: file.id,
                    file_title: file.title,
                  })
                }}
              >
                <Button className="gap-1.5" size="sm" variant="outline">
                  <FileTextIcon className="size-3.5" />
                  <span className="hidden sm:inline">Transcript</span>
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

        <MorphingDialogClose
          className={cn(
            "transition-colors",
            luminance === "dark"
              ? "text-white/90 drop-shadow-md hover:text-white"
              : luminance === "light"
                ? "text-black/70 drop-shadow-md hover:text-black"
                : "text-muted-foreground hover:text-foreground"
          )}
        />
      </MorphingDialogContent>
    </MorphingDialogContainer>
  )
}
