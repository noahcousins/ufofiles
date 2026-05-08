"use client"

import { Play } from "@phosphor-icons/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { HotIndicator } from "@/components/ui/hot-indicator"
import {
  MorphingDialog,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from "@/components/ui/morphing-dialog"
import { getFirstPageUrl } from "@/lib/file-cache"
import { getFileUrl } from "@/lib/file-url"
import { FileDialog } from "./file-dialog"
import { AgencySeal } from "./file-filters"

export function formatFileSize(bytes: number | null): string {
  if (!bytes) {
    return "—"
  }
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

export function getMimeCategory(
  mimeType: string | null
): "PDF" | "VID" | "IMG" {
  if (!mimeType) {
    return "PDF"
  }
  if (mimeType === "application/pdf") {
    return "PDF"
  }
  if (mimeType.startsWith("video/")) {
    return "VID"
  }
  if (mimeType.startsWith("image/")) {
    return "IMG"
  }
  return "PDF"
}

export function formatMimeLabel(mimeType: string | null): string {
  if (!mimeType) {
    return "Unknown"
  }
  if (mimeType === "application/pdf") {
    return "PDF"
  }
  if (mimeType.startsWith("video/")) {
    return "VID"
  }
  if (mimeType.startsWith("image/")) {
    return "IMG"
  }
  return mimeType
}

const VIDEO_REGEX = /\.mp4$/i

function getVideoPreviewUrls(r2Key: string) {
  const parts = r2Key.split("/")
  const filename = parts.pop()!
  const stem = filename.replace(VIDEO_REGEX, "")
  const prefix = parts.join("/")
  return {
    thumb: getFileUrl(`${prefix}/previews/${stem}_thumb.jpg`),
    gif: getFileUrl(`${prefix}/previews/${stem}_preview.gif`),
  }
}

function getPreviewSrc(file: {
  mimeType: string | null
  r2Key: string | null
  thumbnailUrl: string | null
}): string | null {
  const cat = getMimeCategory(file.mimeType)
  if (cat === "IMG" && file.r2Key) {
    return getFileUrl(file.r2Key)
  }
  if (cat === "VID" && file.r2Key) {
    return getVideoPreviewUrls(file.r2Key).thumb
  }
  if (cat === "PDF" && file.r2Key) {
    return getFirstPageUrl(file.r2Key)
  }
  if (cat === "PDF" && file.thumbnailUrl) {
    return file.thumbnailUrl
  }
  return null
}

export const TYPE_COLORS: Record<string, string> = {
  PDF: "text-red-400 border-red-400/30 bg-red-400/5",
  VID: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  IMG: "text-green-400 border-green-400/30 bg-green-400/5",
}

export const TYPE_ICONS: Record<string, React.ReactNode> = {
  PDF: (
    <svg
      className="size-8 text-red-400/60"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <title>PDF</title>
      <path
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  VID: (
    <svg
      className="size-8 text-blue-400/60"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <title>Video</title>
      <path
        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  IMG: (
    <svg
      className="size-8 text-green-400/60"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <title>Image</title>
      <path
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export interface FileItem {
  agency: string
  description: string | null
  documentUrl: string | null
  fileSize: number | null
  id: number
  incidentDate: string | null
  incidentLocation: string | null
  mimeType: string | null
  r2Key: string | null
  releaseDate: string | null
  thumbnailUrl: string | null
  title: string
}

export interface ViewData {
  hotScore: number
  recentViews: number
  views: number
}

function VideoTriggerPreview({
  file,
}: {
  file: { r2Key: string; title: string }
}) {
  const [hovered, setHovered] = useState(false)
  const { thumb, gif } = getVideoPreviewUrls(file.r2Key)

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden border-border/50 border-b bg-black/40"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MorphingDialogImage
        alt={file.title}
        className="h-full w-full object-contain"
        src={thumb}
      />
      {hovered && (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          src={gif}
        />
      )}
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="size-5 text-white" weight="fill" />
          </div>
        </div>
      )}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden border border-border bg-card">
      <div className="aspect-[4/3] w-full border-border/50 border-b bg-muted/40" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded bg-muted/60" />
          <div className="h-3.5 w-2/3 rounded bg-muted/60" />
        </div>
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <div className="size-3 rounded-full bg-muted/60" />
          <div className="h-3 w-16 rounded bg-muted/60" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-10 rounded-full bg-muted/60" />
          <div className="h-3 w-12 rounded bg-muted/60" />
        </div>
      </div>
    </div>
  )
}

export function FileCard({
  file,
  isOpen,
  onOpenChange,
  viewData,
}: {
  file: FileItem
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  viewData?: ViewData
}) {
  const [previewError, setPreviewError] = useState(false)

  const rawPreviewSrc = getPreviewSrc(file)
  const fallbackSrc = file.thumbnailUrl
  const previewSrc = previewError ? fallbackSrc : rawPreviewSrc
  const fileUrl = file.r2Key ? `/files/${encodeURIComponent(file.r2Key)}` : "#"
  const category = getMimeCategory(file.mimeType)

  return (
    <MorphingDialog
      onOpenChange={onOpenChange}
      open={isOpen}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
    >
      <MorphingDialogTrigger className="flex flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-ring/40 hover:bg-muted/30">
        {category === "VID" && file.r2Key ? (
          <VideoTriggerPreview
            file={{ r2Key: file.r2Key, title: file.title }}
          />
        ) : previewSrc ? (
          <MorphingDialogImage
            alt={file.title}
            className="aspect-[4/3] w-full border-border/50 border-b bg-black/10 object-contain"
            onError={() => !previewError && setPreviewError(true)}
            src={previewSrc}
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center border-border/50 border-b">
            {TYPE_ICONS[category] ?? TYPE_ICONS.PDF}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-3">
          <MorphingDialogTitle className="line-clamp-2 font-medium text-xs leading-snug">
            {file.title}
          </MorphingDialogTitle>

          <MorphingDialogSubtitle className="mt-auto flex flex-wrap items-center gap-1.5">
            {file.agency && (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <AgencySeal agency={file.agency} />
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
        </div>
      </MorphingDialogTrigger>

      <FileDialog
        category={category}
        file={file}
        fileUrl={fileUrl}
        previewSrc={previewSrc}
        viewData={viewData}
      />
    </MorphingDialog>
  )
}
