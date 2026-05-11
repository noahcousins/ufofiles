"use client"

import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CaretLeftIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  FileTextIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { prefetchIfNew } from "@/lib/file-cache"
import { getFileUrl, getStreamingVideoUrl } from "@/lib/file-url"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { PdfViewer } from "./pdf-viewer"

const FILE_EXTENSION_REGEX = /\.[^/.]+$/

function getFileName(key: string): string {
  return key.split("/").pop()?.replace(FILE_EXTENSION_REGEX, "") || key
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "—"
  }
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getFileType(key: string): "pdf" | "image" | "video" | "unknown" {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "pdf") {
    return "pdf"
  }
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return "image"
  }
  if (["mp4", "webm", "mov"].includes(ext)) {
    return "video"
  }
  return "unknown"
}

function prefetchFile(key: string) {
  if (!prefetchIfNew(key)) {
    return
  }
  const url = getFileUrl(key)
  const link = document.createElement("link")
  link.rel = "prefetch"
  link.href = url
  link.as = getFileType(key) === "video" ? "video" : "fetch"
  document.head.appendChild(link)
}

export function FileViewer({
  fileKey,
  fileId,
  fileSize,
  prevFileKey,
  nextFileKey,
  currentIndex,
  totalFiles,
  pageCount = 0,
  documentUrl,
  transcriptR2Key,
}: {
  fileKey: string
  fileId: number | null
  fileSize: number
  fileDate: string
  prevFileKey: string | null
  nextFileKey: string | null
  currentIndex: number
  totalFiles: number
  pageCount?: number
  documentUrl?: string | null
  transcriptR2Key?: string | null
}) {
  const router = useRouter()
  const fileUrl = getFileUrl(fileKey)
  const fileType = getFileType(fileKey)

  const recordView = trpc.telemetry.recordView.useMutation()
  useEffect(() => {
    if (!fileId) {
      return
    }
    recordView.mutate({ fileId })
  }, [fileId, recordView.mutate])

  useEffect(() => {
    if (prevFileKey) {
      prefetchFile(prevFileKey)
    }
    if (nextFileKey) {
      prefetchFile(nextFileKey)
    }
  }, [prevFileKey, nextFileKey])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (e.key === "ArrowLeft" && prevFileKey) {
        router.push(`/files/${encodeURIComponent(prevFileKey)}`)
      } else if (e.key === "ArrowRight" && nextFileKey) {
        router.push(`/files/${encodeURIComponent(nextFileKey)}`)
      } else if (e.key === "Escape") {
        router.push("/")
      }
    },
    [router, prevFileKey, nextFileKey]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const isPdfPages = fileType === "pdf" && pageCount > 0

  return (
    <div className={isPdfPages ? "" : "flex h-dvh flex-col"}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-border border-b px-2 py-2 sm:px-4",
          isPdfPages && "sticky top-0 z-10 bg-background"
        )}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button className="sm:hidden" size="sm" variant="outline">
              <ArrowLeftIcon className="size-3.5" />
            </Button>
            <Button
              className="hidden sm:inline-flex"
              size="sm"
              variant="outline"
            >
              Back
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="max-w-full truncate font-medium text-xs">
              {getFileName(fileKey)}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatFileSize(fileSize)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {totalFiles > 0 && (
            <>
              <Button
                className="sm:hidden"
                disabled={!prevFileKey}
                onClick={() => {
                  if (prevFileKey) {
                    posthog.capture("file_viewer_navigated", {
                      direction: "prev",
                      file_key: prevFileKey,
                    })
                    router.push(`/files/${encodeURIComponent(prevFileKey)}`)
                  }
                }}
                size="sm"
                variant="outline"
              >
                <CaretLeftIcon className="size-3.5" />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                disabled={!prevFileKey}
                onClick={() => {
                  if (prevFileKey) {
                    posthog.capture("file_viewer_navigated", {
                      direction: "prev",
                      file_key: prevFileKey,
                    })
                    router.push(`/files/${encodeURIComponent(prevFileKey)}`)
                  }
                }}
                size="sm"
                variant="outline"
              >
                Prev
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {currentIndex + 1}/{totalFiles}
              </span>
              <Button
                className="sm:hidden"
                disabled={!nextFileKey}
                onClick={() => {
                  if (nextFileKey) {
                    posthog.capture("file_viewer_navigated", {
                      direction: "next",
                      file_key: nextFileKey,
                    })
                    router.push(`/files/${encodeURIComponent(nextFileKey)}`)
                  }
                }}
                size="sm"
                variant="outline"
              >
                <CaretRightIcon className="size-3.5" />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                disabled={!nextFileKey}
                onClick={() => {
                  if (nextFileKey) {
                    posthog.capture("file_viewer_navigated", {
                      direction: "next",
                      file_key: nextFileKey,
                    })
                    router.push(`/files/${encodeURIComponent(nextFileKey)}`)
                  }
                }}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </>
          )}

          <a
            download
            href={fileUrl}
            onClick={() =>
              posthog.capture("file_viewer_downloaded", {
                file_key: fileKey,
                file_type: fileType,
              })
            }
          >
            <Button className="sm:hidden" size="sm" variant="default">
              <DownloadSimpleIcon className="size-3.5" />
            </Button>
            <Button
              className="hidden sm:inline-flex"
              size="sm"
              variant="default"
            >
              Download
            </Button>
          </a>

          {transcriptR2Key && (
            <a
              download
              href={getFileUrl(transcriptR2Key)}
              onClick={() =>
                posthog.capture("transcript_downloaded_viewer", {
                  file_key: fileKey,
                })
              }
            >
              <Button className="sm:hidden" size="sm" variant="outline">
                <FileTextIcon className="size-3.5" />
              </Button>
              <Button
                className="hidden gap-1.5 sm:inline-flex"
                size="sm"
                variant="outline"
              >
                <FileTextIcon className="size-3.5" />
                Transcript
              </Button>
            </a>
          )}

          {documentUrl && (
            <a href={documentUrl} rel="noopener noreferrer" target="_blank">
              <Button className="gap-1.5" size="sm" variant="ghost">
                <ArrowSquareOutIcon className="size-3.5" />
                <span className="hidden sm:inline">Source</span>
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className={isPdfPages ? "" : "min-h-0 flex-1"}>
        {fileType === "pdf" && pageCount > 0 ? (
          <PdfViewer pageCount={pageCount} r2Key={fileKey} />
        ) : fileType === "pdf" ? (
          <object
            className="h-full w-full"
            data={fileUrl}
            type="application/pdf"
          >
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <p className="text-muted-foreground text-sm">
                Cannot display PDF inline.
              </p>
              <a download href={fileUrl}>
                <Button>Download PDF</Button>
              </a>
            </div>
          </object>
        ) : null}

        {fileType === "image" && (
          <div className="flex h-full items-center justify-center bg-black/5 p-4">
            <img
              alt={getFileName(fileKey)}
              className="max-h-full max-w-full object-contain"
              src={fileUrl}
            />
          </div>
        )}

        {fileType === "video" && (
          <div className="flex h-full items-center justify-center bg-black">
            <video
              autoPlay
              className="max-h-full max-w-full"
              controls
              src={getStreamingVideoUrl(fileKey)}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {fileType === "unknown" && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-muted-foreground text-sm">
              Cannot preview this file type.
            </p>
            <a download href={fileUrl}>
              <Button>Download File</Button>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
