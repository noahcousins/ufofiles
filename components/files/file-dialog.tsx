"use client"

import {
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ScissorsIcon,
  ShareNetworkIcon,
  XIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import posthog from "posthog-js"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HotIndicator } from "@/components/ui/hot-indicator"
import {
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
import { useDialogArrowKeys } from "./dialog-nav"
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
        className="h-full w-full cursor-pointer object-contain"
        src={src}
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MorphingDialogImage
        alt={alt}
        className={cn(
          "h-full w-full cursor-pointer object-contain",
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
  const { isOpen, setIsOpen } = useMorphingDialog()
  const [clipMode, setClipMode] = useState(false)
  const clipCommit = useClipCommit()
  const bookmark = useBookmark(file.id)

  // Arrow keys navigate the dialog — but not while editing a clip (the editor
  // owns the keyboard then, and navigating would discard the draft).
  useDialogArrowKeys(isOpen && !clipMode, prevFileId, nextFileId, onNavigate)

  const handleNavigate = (direction: "prev" | "next", id: number) => {
    posthog.capture("file_dialog_navigated", { direction, file_id: id })
    onNavigate(id)
  }

  return (
    <MorphingDialogContainer>
      <MorphingDialogContent className="relative flex h-full w-full flex-col overflow-hidden bg-background">
        <div className="flex h-12 shrink-0 items-center gap-2 border-border border-b px-2 sm:px-3">
          <Button
            aria-label="Close"
            className="gap-1.5"
            onClick={() => setIsOpen(false)}
            size="sm"
            variant="ghost"
          >
            <XIcon className="size-4" />
            <span className="hidden sm:inline">Close</span>
          </Button>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-block">
            esc
          </kbd>
          {!clipMode && totalFiles > 1 && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                aria-label="Previous file"
                className="gap-1"
                disabled={prevFileId == null}
                onClick={(e) => {
                  e.stopPropagation()
                  if (prevFileId != null) {
                    handleNavigate("prev", prevFileId)
                  }
                }}
                size="sm"
                variant="ghost"
              >
                <CaretLeftIcon className="size-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="min-w-14 text-center text-muted-foreground text-xs tabular-nums">
                {currentIndex + 1}/{totalFiles}
              </span>
              <Button
                aria-label="Next file"
                className="gap-1"
                disabled={nextFileId == null}
                onClick={(e) => {
                  e.stopPropagation()
                  if (nextFileId != null) {
                    handleNavigate("next", nextFileId)
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
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative flex min-h-0 flex-1 overflow-y-auto bg-black/5 dark:bg-black/50">
            {/* Click-to-close stage behind the media, lightbox-style */}
            <button
              aria-hidden="true"
              className="absolute inset-0 cursor-default"
              onClick={() => setIsOpen(false)}
              tabIndex={-1}
              type="button"
            />
            {category === "VID" && file.r2Key ? (
              <div className="relative z-10 m-auto w-full md:max-w-[calc((100dvh-12rem)*1.7778)]">
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
              </div>
            ) : previewSrc ? (
              <Link
                className="relative z-10 block h-full w-full"
                href={fileUrl}
                onClick={(e) => e.stopPropagation()}
              >
                <ProgressiveDialogImage
                  alt={file.title}
                  src={previewSrc}
                  thumbSrc={thumbSrc}
                />
              </Link>
            ) : (
              <Link
                className="relative z-10 m-auto flex h-48 w-full max-w-xs items-center justify-center transition-opacity hover:opacity-70"
                href={fileUrl}
                onClick={(e) => e.stopPropagation()}
              >
                {TYPE_ICONS[category] ?? TYPE_ICONS.PDF}
              </Link>
            )}
          </div>

          <div className="flex max-h-[45dvh] shrink-0 flex-col border-border border-t bg-background md:max-h-none md:w-96 md:border-t-0 md:border-l lg:w-[420px]">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
              <MorphingDialogTitle className="break-words font-semibold text-lg leading-snug">
                {file.title}
              </MorphingDialogTitle>

              <MorphingDialogSubtitle className="mt-2 flex flex-wrap items-center gap-2">
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
                <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                  {file.description}
                </p>
              )}
            </div>

            {!clipMode && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-border border-t px-5 py-3">
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
        </div>
      </MorphingDialogContent>
    </MorphingDialogContainer>
  )
}
