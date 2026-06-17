"use client"

import {
  DownloadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import posthog from "posthog-js"
import { useEffect, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth/session-provider"
import { isMember } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"

// Module store (mirrors components/ui/toast.tsx): a live render tracker for
// clips you just created. Surfaces queued → rendering → ready in a floating
// card, then hands you Download / View once the render lands. Mounted once via
// <ClipProgress/> in the TRPC provider so it survives navigation.

export interface ClipProgressEntry {
  clipId: number
  endSeconds: number
  fileId: number
  startSeconds: number
  title?: string
}

let entries: ClipProgressEntry[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) {
    l()
  }
}

/** Start tracking a freshly-created clip. Idempotent per clipId. */
export function pushClipProgress(entry: ClipProgressEntry): void {
  if (entries.some((e) => e.clipId === entry.clipId)) {
    return
  }
  entries = [...entries, entry]
  emit()
}

export function dismissClipProgress(clipId: number): void {
  entries = entries.filter((e) => e.clipId !== clipId)
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return entries
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const isTerminal = (status: string) => status === "ready" || status === "failed"

export function ClipProgress() {
  const { data: session } = useSession()
  const active = useSyncExternalStore(subscribe, getSnapshot, () => entries)
  const clipIds = active.map((e) => e.clipId)

  // Source of truth: on load, re-seed any clips still rendering so the card
  // resumes across reloads/devices. Runs once per mount (no refetch), so a
  // dismiss sticks for the session and only reappears on a fresh load while the
  // render is still in flight.
  const inFlight = trpc.clips.activeRenders.useQuery(undefined, {
    enabled: isMember(session?.user),
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    for (const c of inFlight.data ?? []) {
      pushClipProgress({
        clipId: c.clipId,
        fileId: c.fileId,
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
        title: c.title,
      })
    }
  }, [inFlight.data])

  // One poll covers every tracked clip; backs off once they're all terminal.
  const statuses = trpc.clips.renderStatuses.useQuery(
    { clipIds },
    {
      enabled: clipIds.length > 0,
      refetchInterval: (query) => {
        const data = query.state.data
        if (!data?.length) {
          return 4000
        }
        return data.some((r) => !isTerminal(r.status)) ? 4000 : false
      },
    }
  )

  const statusOf = (clipId: number) =>
    statuses.data?.find((r) => r.clipId === clipId)?.status ?? "pending"

  if (active.length === 0) {
    return null
  }

  return (
    // Bottom-right corner (clear of the centered <Toaster/> + consent banner and
    // the feed's centered controls). Height-capped + scrollable so any number of
    // concurrent renders stack without ever growing off-screen.
    <div className="pointer-events-none fixed right-4 bottom-6 z-[100] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 overflow-y-auto">
      <AnimatePresence>
        {active.map((entry) => (
          <ClipProgressCard
            entry={entry}
            key={entry.clipId}
            status={statusOf(entry.clipId)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ClipProgressCard({
  entry,
  status,
}: {
  entry: ClipProgressEntry
  status: string
}) {
  const ready = status === "ready"
  const failed = status === "failed"
  const range = `${formatTime(entry.startSeconds)}–${formatTime(entry.endSeconds)}`

  // Sign the attachment-disposition URL only once the render is ready.
  const download = trpc.clips.getDownloadUrls.useQuery(
    { clipIds: [entry.clipId] },
    { enabled: ready, staleTime: Number.POSITIVE_INFINITY }
  )
  const downloadUrl = download.data?.[0]?.downloadUrl ?? null

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto w-full max-w-sm border border-border bg-card p-3 font-mono text-foreground shadow-lg"
      exit={{ opacity: 0, y: 8 }}
      initial={{ opacity: 0, y: 12 }}
      layout
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-xs">
            {entry.title ?? "Clip"}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {range}
          </p>
        </div>
        <button
          aria-label="Dismiss"
          className="-mt-1 -mr-1 inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => dismissClipProgress(entry.clipId)}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      <div className="mt-2.5">
        {ready && (
          <div className="flex items-center gap-2">
            <a
              className="flex-1"
              download
              href={downloadUrl ?? undefined}
              onClick={() =>
                posthog.capture("clip_progress_downloaded", {
                  clip_id: entry.clipId,
                })
              }
            >
              <Button
                className="w-full gap-1.5"
                disabled={!downloadUrl}
                size="sm"
              >
                <DownloadSimpleIcon className="size-3.5" />
                Download
              </Button>
            </a>
            <Link
              className="flex-1"
              href={`/library?tab=clips&clip=${entry.clipId}`}
              onClick={() => {
                posthog.capture("clip_progress_viewed", {
                  clip_id: entry.clipId,
                })
                dismissClipProgress(entry.clipId)
              }}
            >
              <Button className="w-full" size="sm" variant="outline">
                View
              </Button>
            </Link>
          </div>
        )}

        {failed && (
          <span className="flex items-center gap-1.5 text-[11px] text-destructive">
            <WarningCircleIcon className="size-3.5" weight="fill" />
            Render failed
          </span>
        )}

        {!(ready || failed) && (
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
            {status === "processing" ? "Processing…" : "Queued…"}
          </span>
        )}
      </div>
    </motion.div>
  )
}
