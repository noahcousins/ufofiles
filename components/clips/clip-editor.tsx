"use client"

import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useReducedMotion } from "motion/react"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { CLIP_RENDER_CONFIG } from "@/lib/clips/config"

export interface ClipDraft {
  end: number
  start: number
}

/** Minimal moment shape the editor snaps to (feed Moments are compatible). */
export interface ClipEditorMoment {
  endSeconds: number | null
  startSeconds: number
}

interface ClipEditorProps {
  currentTime: number
  draft: ClipDraft
  duration: number
  moments: ClipEditorMoment[]
  onCancel: () => void
  onChange: (draft: ClipDraft) => void
  onCommit: () => void
  onScrub: (seconds: number) => void
  onTogglePlay: () => void
  playing: boolean
  submitting: boolean
}

// Granularity target: while dragging a handle the bar shows a window this wide
// in px-per-second, so a 320px bar => ~8s window => frame-accurate placement.
const TARGET_PX_PER_SEC = 40
const MIN_DRAG_SPAN = 2
const OVERVIEW_PADDING = 1.6
const MIN_OVERVIEW_SPAN = 8
const SNAP_PX = 8
const EDGE_BAND = 0.15 // pan when the handle enters the outer 15% of the bar
const MIN_CLIP = 1
const MAX_CLIP = CLIP_RENDER_CONFIG.maxClipSeconds

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))

interface Viewport {
  span: number
  start: number
}

export function ClipEditor({
  currentTime,
  draft,
  duration,
  moments,
  onCancel,
  onChange,
  onCommit,
  onScrub,
  onTogglePlay,
  playing,
  submitting,
}: ClipEditorProps) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState(320)
  const [dragging, setDragging] = useState<"start" | "end" | null>(null)
  // True for a beat right after grabbing a handle, so the magnify zoom-in eases
  // instead of snapping. Cleared so the rest of the drag tracks the finger 1:1.
  const [zooming, setZooming] = useState(false)
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [view, setView] = useState<Viewport>({
    start: 0,
    span: Math.max(duration, 1),
  })

  // Refs the window-level pointer handlers read (they're attached once).
  const viewRef = useRef(view)
  viewRef.current = view
  const draftRef = useRef(draft)
  draftRef.current = draft
  const barWidthRef = useRef(barWidth)
  barWidthRef.current = barWidth

  const momentEdges = useMemo(() => {
    const edges = new Set<number>()
    for (const m of moments) {
      edges.add(m.startSeconds)
      if (m.endSeconds != null) {
        edges.add(m.endSeconds)
      }
    }
    return [...edges]
  }, [moments])

  useEffect(() => {
    const bar = trackRef.current
    if (!bar) {
      return
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBarWidth(entry.contentRect.width)
      }
    })
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  useEffect(
    () => () => {
      if (zoomTimer.current) {
        clearTimeout(zoomTimer.current)
      }
    },
    []
  )

  // Idle viewport: frame the selection with padding (eases via CSS transition
  // on the positioned elements). Recomputed only when not dragging.
  useEffect(() => {
    if (dragging) {
      return
    }
    const selSpan = Math.max(draft.end - draft.start, MIN_OVERVIEW_SPAN)
    const span = clamp(selSpan * OVERVIEW_PADDING, MIN_OVERVIEW_SPAN, duration)
    const center = (draft.start + draft.end) / 2
    const start = clamp(center - span / 2, 0, Math.max(0, duration - span))
    setView({ start, span })
  }, [dragging, draft.start, draft.end, duration])

  const xFromTime = useCallback(
    (t: number) => ((t - view.start) / view.span) * barWidth,
    [view, barWidth]
  )

  const snap = useCallback(
    (t: number, span: number, width: number) => {
      const tol = (SNAP_PX * span) / width
      for (const e of momentEdges) {
        if (Math.abs(t - e) < tol) {
          return e
        }
      }
      return t
    },
    [momentEdges]
  )

  const handlePointerDown = useCallback(
    (which: "start" | "end") => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(which)
      // Ease the zoom-in for one beat, then track the finger crisply.
      setZooming(true)
      if (zoomTimer.current) {
        clearTimeout(zoomTimer.current)
      }
      zoomTimer.current = setTimeout(() => setZooming(false), 200)
      // Magnify around the grabbed handle.
      const span = clamp(
        barWidthRef.current / TARGET_PX_PER_SEC,
        MIN_DRAG_SPAN,
        duration
      )
      const handleTime =
        which === "start" ? draftRef.current.start : draftRef.current.end
      const start = clamp(
        handleTime - span / 2,
        0,
        Math.max(0, duration - span)
      )
      const next = { start, span }
      viewRef.current = next
      setView(next)
    },
    [duration]
  )

  // Window-level drag handling (pointer events unify mouse + touch).
  useEffect(() => {
    if (!dragging) {
      return
    }

    const move = (e: PointerEvent) => {
      const bar = trackRef.current
      if (!bar) {
        return
      }
      const rect = bar.getBoundingClientRect()
      const width = barWidthRef.current
      const v = viewRef.current
      const x = clamp(e.clientX - rect.left, 0, width)
      let t = v.start + (x / width) * v.span
      t = snap(t, v.span, width)

      const d = draftRef.current
      if (dragging === "start") {
        // start ∈ [end-MAX_CLIP, end-MIN_CLIP], not below 0
        t = clamp(t, Math.max(0, d.end - MAX_CLIP), d.end - MIN_CLIP)
        onChange({ start: t, end: d.end })
      } else {
        // end ∈ [start+MIN_CLIP, start+MAX_CLIP], not past duration
        t = clamp(t, d.start + MIN_CLIP, Math.min(duration, d.start + MAX_CLIP))
        onChange({ start: d.start, end: t })
      }
      onScrub(t)

      // Pan when the handle nears the bar edges.
      const frac = x / width
      let viewStart = v.start
      if (frac < EDGE_BAND) {
        viewStart = t - EDGE_BAND * v.span
      } else if (frac > 1 - EDGE_BAND) {
        viewStart = t - (1 - EDGE_BAND) * v.span
      }
      viewStart = clamp(viewStart, 0, Math.max(0, duration - v.span))
      if (viewStart !== v.start) {
        const next = { start: viewStart, span: v.span }
        viewRef.current = next
        setView(next)
      }
    }

    const up = () => setDragging(null)

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [dragging, duration, onChange, onScrub, snap])

  const startX = xFromTime(draft.start)
  const endX = xFromTime(draft.end)
  const playheadX = xFromTime(currentTime)
  const clipLen = Math.max(0, draft.end - draft.start)
  // On-screen morph → ease-in-out, <300ms. Crisp (no transition) while actively
  // tracking the finger, but eased through the zoom-in (zooming) and the
  // zoom-out/reframe on release (dragging === null). Disabled for reduced motion.
  const trackingFinger = dragging !== null && !zooming
  const eased =
    reduceMotion || trackingFinger
      ? ""
      : "transition-[left,width] duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)]"

  return (
    <div className="absolute right-0 bottom-0 left-0 z-40 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-4">
      {/* Time readouts */}
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-white/80 tabular-nums">
        <span>{formatTime(draft.start)}</span>
        <span className="text-[#FFD60A]">{formatTime(clipLen)} clip</span>
        <span>{formatTime(draft.end)}</span>
      </div>

      {/* Track */}
      <div className="relative h-12 touch-none select-none" ref={trackRef}>
        {/* Baseline */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/15" />

        {/* Moment snap targets (faint) */}
        {momentEdges.map((e) => {
          const x = xFromTime(e)
          if (x < 0 || x > barWidth) {
            return null
          }
          return (
            <span
              className={`absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/30 ${eased}`}
              key={`edge-${e}`}
              style={{ left: x }}
            />
          )
        })}

        <div
          className={`absolute top-1/2 h-8 -translate-y-1/2 border-[#FFD60A] border-y-2 bg-[#FFD60A]/15 ${eased}`}
          style={{
            left: clamp(startX, 0, barWidth),
            width: clamp(endX, 0, barWidth) - clamp(startX, 0, barWidth),
          }}
        />

        {/* Playhead */}
        {playheadX >= 0 && playheadX <= barWidth && (
          <span
            className="absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white"
            style={{ left: playheadX }}
          />
        )}

        {/* Handles */}
        <Handle
          eased={eased}
          onPointerDown={handlePointerDown("start")}
          x={clamp(startX, 0, barWidth)}
        />
        <Handle
          eased={eased}
          onPointerDown={handlePointerDown("end")}
          x={clamp(endX, 0, barWidth)}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between">
        <button
          aria-label="Discard"
          className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-white/70 text-xs transition-colors hover:text-white"
          onClick={onCancel}
          type="button"
        >
          <XIcon className="size-4" />
          Discard
        </button>

        <button
          aria-label={playing ? "Pause" : "Play"}
          className="flex items-center justify-center p-1 text-white/90 transition-colors hover:text-white"
          onClick={onTogglePlay}
          type="button"
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>

        <button
          aria-label="Add clip"
          className="flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-black text-xs transition-opacity disabled:opacity-50"
          disabled={submitting}
          onClick={onCommit}
          type="button"
        >
          {submitting ? (
            <Spinner className="text-current" />
          ) : (
            <>
              <CheckIcon className="size-4" weight="bold" />
              Add Clip
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Sharp-cornered play/pause (Phosphor's fill icons have the rounding baked
// into the path, so we use bare SVGs to get pointed corners).
function PlayGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-7"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M7 4 L20 12 L7 20 Z" />
    </svg>
  )
}

function PauseGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-7"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M6 4 H10 V20 H6 Z M14 4 H18 V20 H14 Z" />
    </svg>
  )
}

function Handle({
  x,
  eased,
  onPointerDown,
}: {
  eased: string
  onPointerDown: (e: React.PointerEvent) => void
  x: number
}) {
  return (
    <button
      aria-label="Clip boundary"
      className={`absolute top-1/2 flex h-10 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center ${eased}`}
      onPointerDown={onPointerDown}
      style={{ left: x }}
      type="button"
    >
      <span className="h-9 w-2 bg-[#FFD60A] shadow-md" />
    </button>
  )
}
