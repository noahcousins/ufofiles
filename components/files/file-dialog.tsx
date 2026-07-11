"use client"

import {
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  ScissorsIcon,
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
import { useBookmark } from "@/lib/bookmarks/use-bookmark"
import { useClipCommit } from "@/lib/clips/use-clip-commit"
import {
  getFileUrl,
  getStreamingVideoUrl,
  withDownloadParam,
} from "@/lib/file-url"
import { cn, formatFileSize } from "@/lib/utils"
import { DialogNav, useDialogArrowKeys } from "./dialog-nav"
import {
  type FileItem,
  formatMimeLabel,
  TYPE_COLORS,
  TYPE_ICONS,
  type ViewData,
} from "./file-card"
import { AgencySeal } from "./filter-controls"
import { VideoPlayer } from "./video-player"

function DialogVideoPlayer({
  r2Key,
  poster,
  clipMode,
  clipSubmitting,
  onCommitClip,
  onExitClip,
}: {
  poster?: string | null
  r2Key: string
  clipMode?: boolean
  clipSubmitting?: boolean
  onCommitClip?: (start: number, end: number, duration: number) => void
  onExitClip?: () => void
}) {
  // Reuses the shared in-app player; the dialog open state drives autoplay.
  const { isOpen } = useMorphingDialog()
  return (
    <VideoPlayer
      active={isOpen}
      clipMode={clipMode}
      clipSubmitting={clipSubmitting}
      onCommitClip={onCommitClip}
      onExitClip={onExitClip}
      poster={poster}
      src={getStreamingVideoUrl(r2Key)}
    />
  )
}

function ShareButton({ fileId, fileUrl }: { fileId: number; fileUrl: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const url = new URL(fileUrl, window.location.origin)
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        posthog.capture("file_shared", { file_id: fileId })
      })
    },
    [fileId, fileUrl]
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: dialog branches across media types (video/image/pdf), nav, and opt-in clip mode
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
  const [clipMode, setClipMode] = useState(false)
  const clipCommit = useClipCommit()
  const bookmark = useBookmark(file.id)

  // Arrow keys navigate the dialog — but not while editing a clip (the editor
  // owns the keyboard then, and navigating would discard the draft).
  useDialogArrowKeys(isOpen && !clipMode, prevFileId, nextFileId, onNavigate)

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
          {!clipMode && (
            <DialogNav
              currentIndex={currentIndex}
              nextId={nextFileId}
              onNavigate={onNavigate}
              onNavigateCapture={(direction, id) =>
                posthog.capture("file_dialog_navigated", {
                  direction,
                  file_id: id,
                })
              }
              prevId={prevFileId}
              total={totalFiles}
            />
          )}

          <div className="relative shrink-0" ref={previewRef}>
            {category === "VID" && file.r2Key ? (
              <DialogVideoPlayer
                clipMode={clipMode}
                clipSubmitting={clipCommit.submitting}
                onCommitClip={(start, end, duration) =>
                  clipCommit.commitClip(
                    {
                      fileId: file.id,
                      start,
                      end,
                      duration,
                      title: file.title,
                    },
                    () => setClipMode(false)
                  )
                }
                onExitClip={() => setClipMode(false)}
                poster={previewSrc}
                r2Key={file.r2Key}
              />
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

          {!clipMode && (
            <div className="flex shrink-0 items-center gap-2 border-border border-t px-5 py-3">
              {file.r2Key && (
                <a
                  download
                  href={withDownloadParam(getFileUrl(file.r2Key))}
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
              <Button
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!(bookmark.isBookmarked || bookmark.mutating)) {
                    posthog.capture("file_bookmarked", { file_id: file.id })
                  }
                  bookmark.toggle()
                }}
                size="sm"
                variant="ghost"
              >
                <BookmarkSimpleIcon
                  className="size-3.5"
                  weight={bookmark.isBookmarked ? "fill" : "regular"}
                />
                {bookmark.isBookmarked ? "Saved" : "Bookmark"}
              </Button>
              {category === "VID" && file.r2Key && (
                <Button
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    setClipMode(true)
                    posthog.capture("file_clip_started", { file_id: file.id })
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <ScissorsIcon className="size-3.5" weight="fill" />
                  Clip
                </Button>
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
              <ShareButton fileId={file.id} fileUrl={fileUrl} />
            </div>
          )}
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
