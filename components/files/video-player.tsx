"use client"

import {
  CornersInIcon,
  CornersOutIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type ClipDraft,
  ClipEditor,
  type ClipEditorMoment,
} from "@/components/clips/clip-editor"
import { cn } from "@/lib/utils"

const DEFAULT_CLIP_SECONDS = 15

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

/**
 * The app's standard video player + custom controls (play/pause, scrubber,
 * volume, fullscreen). Plays whatever `src` it's handed — a worker streaming
 * URL from the file browser, or a presigned rendered-clip URL from the Library.
 * `active` mirrors visibility: false pauses and rewinds (the file dialog passes
 * its open state; standalone uses default true to autoplay on mount).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a media player with custom controls (play, scrub, volume, fullscreen) + opt-in clip mode is inherently many small handlers
export function VideoPlayer({
  src,
  poster,
  active = true,
  clipMode = false,
  clipMoments = [],
  clipSubmitting = false,
  onCommitClip,
  onExitClip,
}: {
  active?: boolean
  poster?: string | null
  src: string
  /** When true, the player becomes the clip editor (takeover) driving this
   * same `<video>`. Opt-in — off for plain playback (e.g. the clip dialog). */
  clipMode?: boolean
  clipMoments?: ClipEditorMoment[]
  clipSubmitting?: boolean
  onCommitClip?: (start: number, end: number, duration: number) => void
  onExitClip?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [clipDraft, setClipDraft] = useState<ClipDraft | null>(null)
  // Read by the once-bound timeupdate loop below.
  const clipModeRef = useRef(clipMode)
  clipModeRef.current = clipMode
  const clipDraftRef = useRef<ClipDraft | null>(null)
  clipDraftRef.current = clipDraft

  // Active/visibility autoplay — suspended in clip mode, which drives playback
  // itself (loop within bounds).
  useEffect(() => {
    const v = videoRef.current
    if (!v || clipMode) {
      return
    }
    if (active) {
      v.play().catch(() => {
        // no-op
      })
    } else {
      v.pause()
      v.currentTime = 0
      setPlaying(false)
    }
  }, [active, clipMode])

  // Enter/exit clip mode: seed bounds at the playhead (+15s), pause, park at the
  // in-point. Clearing the draft on exit restores the normal player.
  useEffect(() => {
    const v = videoRef.current
    if (!(clipMode && v)) {
      setClipDraft(null)
      return
    }
    const dur = v.duration || duration
    const start = Math.max(0, v.currentTime)
    const end = dur
      ? Math.min(start + DEFAULT_CLIP_SECONDS, dur)
      : start + DEFAULT_CLIP_SECONDS
    v.pause()
    v.currentTime = start
    setClipDraft({ start, end: Math.max(end, start + 1) })
  }, [clipMode, duration])

  const handleClipScrub = useCallback((seconds: number) => {
    const v = videoRef.current
    if (v) {
      v.currentTime = seconds
    }
  }, [])

  const clipTogglePlay = useCallback(() => {
    const v = videoRef.current
    const d = clipDraftRef.current
    if (!(v && d)) {
      return
    }
    if (v.paused) {
      if (v.currentTime < d.start || v.currentTime >= d.end) {
        v.currentTime = d.start
      }
      v.play().catch(() => undefined)
    } else {
      v.pause()
    }
  }, [])

  const handleClipCommit = useCallback(() => {
    const v = videoRef.current
    const d = clipDraftRef.current
    if (!(v && d)) {
      return
    }
    onCommitClip?.(d.start, d.end, v.duration || duration)
  }, [onCommitClip, duration])

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
      {/* biome-ignore lint/a11y/useMediaCaption: archive footage has no caption track */}
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
        onTimeUpdate={() => {
          const v = videoRef.current
          if (!v) {
            return
          }
          // Loop within the draft bounds while editing a clip.
          const d = clipDraftRef.current
          if (clipModeRef.current && d && v.currentTime >= d.end) {
            v.currentTime = d.start
          }
          setCurrentTime(v.currentTime)
        }}
        playsInline
        poster={poster ?? undefined}
        ref={videoRef}
        src={src}
      />

      {!(clipMode || playing) && (
        <button
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
          onClick={togglePlay}
          type="button"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm dark:bg-white/80">
            <PlayIcon className="size-7 text-black" weight="fill" />
          </div>
        </button>
      )}

      {clipMode && clipDraft ? (
        <ClipEditor
          currentTime={currentTime}
          draft={clipDraft}
          duration={duration}
          moments={clipMoments}
          onCancel={() => onExitClip?.()}
          onChange={setClipDraft}
          onCommit={handleClipCommit}
          onScrub={handleClipScrub}
          onTogglePlay={clipTogglePlay}
          playing={playing}
          submitting={clipSubmitting}
        />
      ) : (
        <div className="flex h-11 items-center gap-2 bg-black/80 px-3 backdrop-blur-sm">
          <button
            aria-label={playing ? "Pause" : "Play"}
            className="shrink-0 text-white/80 hover:text-white"
            onClick={togglePlay}
            type="button"
          >
            {playing ? (
              <PauseIcon className="size-4" weight="fill" />
            ) : (
              <PlayIcon className="size-4" weight="fill" />
            )}
          </button>

          <span className="shrink-0 text-[11px] text-white/60 tabular-nums">
            {formatTime(dragPct === null ? currentTime : dragPct * duration)}
          </span>

          {/* biome-ignore lint/a11y/noStaticElementInteractions: custom drag scrubber (matches the file dialog's player) */}
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: custom drag scrubber */}
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
            aria-label={muted ? "Unmute" : "Mute"}
            className="shrink-0 text-white/80 hover:text-white"
            onClick={toggleMute}
            type="button"
          >
            {muted || volume === 0 ? (
              <svg
                aria-hidden="true"
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
                aria-hidden="true"
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
            aria-label="Volume"
            className="h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 accent-white [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            max={1}
            min={0}
            onChange={handleVolumeChange}
            step={0.05}
            type="range"
            value={muted ? 0 : volume}
          />

          <button
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
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
      )}
    </div>
  )
}
