"use client"

import {
  DownloadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth/session-provider"
import { isMember } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"

// Module store (mirrors components/ui/toast.tsx): a live render tracker for
// clips you just created. Surfaces queued → rendering → ready in a slim banner
// pinned under the top menu, then hands you Download / View once the render
// lands. Mounted once via <ClipProgress/> in the TRPC provider so it survives
// navigation.

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
  const pathname = usePathname()
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
    // Slim banner tucked under the top menu (out of the way of the video and
    // the bottom consent banner). The watch page's fixed feed header is a bit
    // taller than the sticky site header, hence the per-route offset.
    // Height-capped + scrollable so any number of concurrent renders stack
    // without ever growing off-screen.
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[100] flex max-h-[40vh] flex-col items-center gap-1.5 overflow-y-auto px-4",
        pathname === "/watch" ? "top-[4.25rem]" : "top-16"
      )}
    >
      <AnimatePresence>
        {active.map((entry) => (
          <ClipProgressBanner
            entry={entry}
            key={entry.clipId}
            status={statusOf(entry.clipId)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ClipProgressBanner({
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
      className="pointer-events-auto flex max-w-full items-center gap-2.5 border border-border bg-card/90 py-1.5 pr-1 pl-3 font-mono text-foreground shadow-lg backdrop-blur-sm"
      exit={{ opacity: 0, y: -8 }}
      initial={{ opacity: 0, y: -12 }}
      layout
      transition={{ duration: 0.18 }}
    >
      {failed ? (
        <WarningCircleIcon
          className="size-3.5 shrink-0 text-destructive"
          weight="fill"
        />
      ) : (
        !ready && (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        )
      )}

      <span className="min-w-0 truncate text-[11px]">
        <span className="font-medium">{entry.title ?? "Clip"}</span>
        <span className="ml-2 text-muted-foreground tabular-nums">{range}</span>
      </span>

      {ready && (
        <span className="flex shrink-0 items-center gap-1">
          <a
            download
            href={downloadUrl ?? undefined}
            onClick={() =>
              posthog.capture("clip_progress_downloaded", {
                clip_id: entry.clipId,
              })
            }
          >
            <Button className="gap-1.5" disabled={!downloadUrl} size="xs">
              <DownloadSimpleIcon className="size-3.5" />
              Download
            </Button>
          </a>
          <Link
            href={`/library?tab=clips&clip=${entry.clipId}`}
            onClick={() => {
              posthog.capture("clip_progress_viewed", {
                clip_id: entry.clipId,
              })
              dismissClipProgress(entry.clipId)
            }}
          >
            <Button size="xs" variant="ghost">
              View
            </Button>
          </Link>
        </span>
      )}

      {failed && (
        <span className="shrink-0 text-[11px] text-destructive">
          Render failed
        </span>
      )}

      {!(ready || failed) && (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {status === "processing" ? "Processing…" : "Queued…"}
        </span>
      )}

      <button
        aria-label="Dismiss"
        className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => dismissClipProgress(entry.clipId)}
        type="button"
      >
        <XIcon className="size-3.5" />
      </button>
    </motion.div>
  )
}
