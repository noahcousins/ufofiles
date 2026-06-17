"use client"

import { Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react"
import type React from "react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { VideoMoment } from "./video-panel"

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const SNAP_THRESHOLD = 0.04
const EXPANDED_HEIGHT = 20
const COLLAPSED_HEIGHT = 6
const BASELINE = 3
const BUMP_HEIGHT = 14
const BUMP_SIGMA = 0.02
const TICK_WIDTH = 2
const TICK_HEIGHT = 6

function gaussian(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma
  return Math.exp(-0.5 * d * d)
}

function buildTerrainPath(
  momentPcts: number[],
  width: number,
  height: number
): string {
  const steps = Math.max(Math.round(width), 200)
  const points: [number, number][] = []

  for (let i = 0; i <= steps; i++) {
    const x = i / steps
    let y = BASELINE
    for (const mu of momentPcts) {
      y += BUMP_HEIGHT * gaussian(x, mu, BUMP_SIGMA)
    }
    points.push([x * width, height - y])
  }

  let d = `M 0 ${height} L ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`
  }
  d += ` L ${width} ${height} Z`
  return d
}

interface VideoControlsProps {
  currentTime: number
  duration: number
  moments: VideoMoment[]
  muted: boolean
  onExpandChange?: (expanded: boolean) => void
  onMuteToggle: () => void
  onSeek: (pct: number) => void
  onTogglePlay: () => void
  onTooltipChange?: (text: string | null) => void
  playing: boolean
  showUnmute: boolean
}

export function VideoControls({
  playing,
  muted,
  currentTime,
  duration,
  moments,
  showUnmute,
  onExpandChange,
  onTogglePlay,
  onMuteToggle,
  onTooltipChange,
  onSeek,
}: VideoControlsProps) {
  const clipId = useId()
  const [showPlayIcon, setShowPlayIcon] = useState(false)
  const [lastAction, setLastAction] = useState<"play" | "pause">("play")
  const progressRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [dragPct, setDragPct] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [activeTooltip, setActiveTooltip] = useState<{
    pct: number
    text: string
  } | null>(null)
  const [barWidth, setBarWidth] = useState(300)
  const fillPct = useMotionValue(0)
  const fillWidth = useTransform(fillPct, (v) => v * barWidth)
  const snapAnimRef = useRef<ReturnType<typeof animate> | null>(null)

  useEffect(() => {
    const bar = progressRef.current
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

  const momentPcts = useMemo(() => {
    if (duration <= 0) {
      return []
    }
    return moments.map((m) => ({
      pct: m.startSeconds / duration,
      description: m.description,
    }))
  }, [moments, duration])

  const rawMomentPcts = useMemo(
    () => momentPcts.map((m) => m.pct),
    [momentPcts]
  )

  const terrainPath = useMemo(
    () => buildTerrainPath(rawMomentPcts, barWidth, EXPANDED_HEIGHT),
    [rawMomentPcts, barWidth]
  )

  const snapToPct = useCallback(
    (rawPct: number): number => {
      for (const m of momentPcts) {
        if (Math.abs(rawPct - m.pct) < SNAP_THRESHOLD) {
          return m.pct
        }
      }
      return rawPct
    },
    [momentPcts]
  )

  const findTooltipAt = useCallback(
    (pct: number): { pct: number; text: string } | null => {
      for (const m of momentPcts) {
        if (Math.abs(pct - m.pct) < SNAP_THRESHOLD) {
          return { pct: m.pct, text: m.description }
        }
      }
      return null
    },
    [momentPcts]
  )

  const realPct = duration > 0 ? currentTime / duration : 0
  const displayPct = dragPct ?? realPct

  useEffect(() => {
    if (!draggingRef.current) {
      fillPct.jump(realPct)
    }
  }, [realPct, fillPct])

  const seekToSnap = useCallback(
    (snapped: number, didSnap: boolean) => {
      snapAnimRef.current?.stop()
      if (didSnap) {
        snapAnimRef.current = animate(fillPct, snapped, {
          type: "spring",
          stiffness: 500,
          damping: 40,
          mass: 0.3,
        })
      } else {
        fillPct.jump(snapped)
      }
    },
    [fillPct]
  )

  const handleCenterTap = useCallback(() => {
    setLastAction(playing ? "pause" : "play")
    setShowPlayIcon(true)
    onTogglePlay()
  }, [playing, onTogglePlay])

  useEffect(() => {
    if (!showPlayIcon) {
      return
    }
    const timer = setTimeout(() => setShowPlayIcon(false), 600)
    return () => clearTimeout(timer)
  }, [showPlayIcon])

  const pctFromX = useCallback((clientX: number) => {
    const bar = progressRef.current
    if (!bar) {
      return 0
    }
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const expand = useCallback(() => {
    if (!expanded) {
      setExpanded(true)
      onExpandChange?.(true)
    }
  }, [expanded, onExpandChange])

  const collapse = useCallback(() => {
    setExpanded(false)
    onExpandChange?.(false)
  }, [onExpandChange])

  const handleDrag = useCallback(
    (raw: number) => {
      const snapped = snapToPct(raw)
      setDragPct(snapped)
      const tooltip = findTooltipAt(snapped)
      setActiveTooltip(tooltip)
      onTooltipChange?.(tooltip?.text ?? null)
      seekToSnap(snapped, snapped !== raw)
    },
    [snapToPct, findTooltipAt, seekToSnap, onTooltipChange]
  )

  const handleProgressDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      draggingRef.current = true
      expand()
      const raw = pctFromX(e.clientX)
      handleDrag(raw)
      onSeek(snapToPct(raw))
    },
    [pctFromX, handleDrag, snapToPct, onSeek, expand]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      draggingRef.current = true
      expand()
      const raw = pctFromX(e.touches[0].clientX)
      handleDrag(raw)
      onSeek(snapToPct(raw))
    },
    [pctFromX, handleDrag, snapToPct, onSeek, expand]
  )

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) {
        return
      }
      e.preventDefault()
      handleDrag(pctFromX(e.clientX))
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) {
        return
      }
      handleDrag(pctFromX(e.touches[0].clientX))
    }
    const commit = (finalPct: number) => {
      draggingRef.current = false
      const snapped = snapToPct(finalPct)
      onSeek(snapped)
      setDragPct(null)
      setActiveTooltip(null)
      onTooltipChange?.(null)
      collapse()
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
  }, [pctFromX, handleDrag, snapToPct, onSeek, collapse])

  const barHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT

  return (
    <>
      {/* Tap area for play/pause */}
      <button
        aria-label={playing ? "Pause" : "Play"}
        className="absolute inset-0 z-10"
        onClick={handleCenterTap}
        type="button"
      />

      {/* Animated play/pause icon */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            exit={{ opacity: 0, scale: 1.5 }}
            initial={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex size-16 items-center justify-center rounded-none bg-black/50 backdrop-blur-sm">
              {lastAction === "pause" ? (
                <Pause className="size-8 text-white" weight="fill" />
              ) : (
                <Play className="size-8 text-white" weight="fill" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to unmute indicator */}
      <AnimatePresence>
        {showUnmute && (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-none bg-black/60 px-4 py-2 font-mono text-white text-xs backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, y: 10 }}
            onClick={(e) => {
              e.stopPropagation()
              onMuteToggle()
            }}
            type="button"
          >
            Tap to unmute
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom controls bar */}
      <div className="absolute right-0 bottom-0 left-0 z-30">
        {/* Progress bar */}
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="font-mono text-[10px] text-white/60 tabular-nums leading-none">
            {formatTime(dragPct === null ? currentTime : dragPct * duration)}
          </span>
          <div
            aria-label="Video progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(displayPct * 100)}
            className="group relative flex-1 cursor-pointer touch-none select-none overflow-visible before:absolute before:inset-x-0 before:-top-3 before:-bottom-3 before:content-['']"
            onMouseDown={handleProgressDown}
            onTouchStart={handleTouchStart}
            ref={progressRef}
            role="slider"
            style={{ height: BASELINE }}
            tabIndex={0}
          >
            {/* Collapsed: flat bar + tick marks */}
            <motion.div
              animate={{ opacity: expanded ? 0 : 1 }}
              className="absolute right-0 bottom-0 left-0 overflow-visible"
              transition={{ duration: 0.2 }}
            >
              {/* Flat baseline track */}
              <div
                className="absolute right-0 bottom-0 left-0 rounded-none bg-white/20"
                style={{ height: BASELINE }}
              />
              {/* Filled portion */}
              <motion.div
                className="absolute bottom-0 left-0 rounded-none bg-white/80"
                style={{ height: BASELINE, width: fillWidth }}
              />
              {/* Tick marks */}
              {rawMomentPcts.map((pct, i) => (
                <span
                  className="absolute bottom-0 bg-white"
                  key={`${i}-${pct}`}
                  style={{
                    left: `${pct * 100}%`,
                    width: TICK_WIDTH,
                    height: TICK_HEIGHT,
                    transform: "translateX(-50%)",
                  }}
                />
              ))}
            </motion.div>

            {/* Expanded: terrain peaks */}
            <motion.div
              animate={{ opacity: expanded ? 1 : 0, scaleY: expanded ? 1 : 0 }}
              className="absolute right-0 bottom-0 left-0 origin-bottom overflow-visible"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <svg
                aria-hidden="true"
                className="absolute bottom-0 left-0 overflow-visible"
                height={EXPANDED_HEIGHT}
                preserveAspectRatio="none"
                width={barWidth}
              >
                <path className="fill-white/25" d={terrainPath} />
              </svg>

              <svg
                aria-hidden="true"
                className="absolute bottom-0 left-0 overflow-visible"
                height={EXPANDED_HEIGHT}
                preserveAspectRatio="none"
                width={barWidth}
              >
                <defs>
                  <clipPath id={clipId}>
                    <motion.rect
                      height={EXPANDED_HEIGHT * 3}
                      style={{ width: fillWidth }}
                      y={-EXPANDED_HEIGHT}
                    />
                  </clipPath>
                </defs>
                <path
                  className="fill-white/80"
                  clipPath={`url(#${clipId})`}
                  d={terrainPath}
                />
              </svg>
            </motion.div>
          </div>
          <span className="font-mono text-[10px] text-white/60 tabular-nums leading-none">
            {formatTime(duration)}
          </span>
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            className="relative z-30 p-1 text-white/70 hover:text-white"
            onClick={(e) => {
              e.stopPropagation()
              onMuteToggle()
            }}
            type="button"
          >
            {muted ? (
              <SpeakerSlash className="size-4" weight="fill" />
            ) : (
              <SpeakerHigh className="size-4" weight="fill" />
            )}
          </button>
        </div>
      </div>
    </>
  )
}
