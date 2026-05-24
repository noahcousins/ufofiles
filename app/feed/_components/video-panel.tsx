"use client"

import posthog from "posthog-js"
import { useCallback, useEffect, useRef, useState } from "react"
import { getHlsPlaylistUrl, getVideoThumbUrl } from "@/lib/file-url"
import { trpc } from "@/lib/trpc/client"
import type { LoadState } from "./preload-window"
import { useHlsPlayer } from "./use-hls-player"
import { VideoActions } from "./video-actions"
import { VideoControls } from "./video-controls"
import { VideoMetadata } from "./video-metadata"

export interface VideoMoment {
  description: string
  endSeconds: number | null
  id: number
  startSeconds: number
}

export interface FeedItem {
  agency: string | null
  description: string | null
  fileSize: number | null
  id: number
  incidentDate: string | null
  incidentLocation: string | null
  mimeType: string | null
  moments: VideoMoment[]
  r2Key: string | null
  tags: { slug: string; label: string }[]
  title: string
}

interface VideoPanelProps {
  hasInteracted: boolean
  index: number
  isActive: boolean
  item: FeedItem
  loadState: LoadState
  muted: boolean
  onAdvance: () => void
  onInteract: () => void
  onMuteToggle: () => void
  registerRef: (index: number, el: HTMLDivElement | null) => void
}

export function VideoPanel({
  hasInteracted,
  index,
  isActive,
  item,
  loadState,
  muted,
  onAdvance,
  onInteract,
  onMuteToggle,
  registerRef,
}: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showUnmute, setShowUnmute] = useState(false)
  const viewRecorded = useRef(false)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  const hasInteractedRef = useRef(hasInteracted)
  hasInteractedRef.current = hasInteracted
  const didWarmup = useRef(false)

  const hlsUrl =
    loadState !== "idle" && item.r2Key ? getHlsPlaylistUrl(item.r2Key) : null
  const { isReady } = useHlsPlayer(videoRef, hlsUrl)

  // Reset warmup flag when HLS URL changes (video unloaded then reloaded)
  const prevHlsUrl = useRef(hlsUrl)
  if (hlsUrl !== prevHlsUrl.current) {
    prevHlsUrl.current = hlsUrl
    didWarmup.current = false
  }

  const recordView = trpc.telemetry.recordView.useMutation()

  useEffect(() => {
    if (!isActive) {
      viewRecorded.current = false
      return
    }

    const timer = setTimeout(() => {
      if (!viewRecorded.current) {
        viewRecorded.current = true
        recordView.mutate({ fileId: item.id })
        posthog.capture("feed_video_viewed", {
          file_id: item.id,
          file_title: item.title,
          index,
        })
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isActive, item.id, item.title, index, recordView])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    if (!(v && isActiveRef.current && hasInteractedRef.current)) {
      return
    }

    v.play().catch(() => {
      const retry = () => {
        if (isActiveRef.current) {
          v.play().catch(() => undefined)
        }
      }
      v.addEventListener("canplay", retry, { once: true })
    })
  }, [])

  // Active/inactive playback control
  // biome-ignore lint/correctness/useExhaustiveDependencies: isReady re-triggers play when HLS finishes loading
  useEffect(() => {
    const v = videoRef.current
    if (!v) {
      return
    }

    if (isActive && hasInteracted) {
      tryPlay()
    } else if (!isActive) {
      v.pause()
    }
  }, [isActive, hasInteracted, isReady, tryPlay])

  // Warmup: briefly play preloaded videos to prime the decoder
  useEffect(() => {
    const v = videoRef.current
    if (!v || loadState !== "preload" || didWarmup.current) {
      return
    }

    let warmupTimer: ReturnType<typeof setTimeout> | undefined

    const doWarmup = () => {
      if (didWarmup.current || isActiveRef.current) {
        return
      }
      didWarmup.current = true

      v.muted = true
      v.play()
        .then(() => {
          warmupTimer = setTimeout(() => {
            if (!isActiveRef.current) {
              v.pause()
              v.currentTime = 0
            }
          }, 120)
        })
        .catch(() => undefined)
    }

    if (v.readyState >= 1) {
      doWarmup()
    } else {
      v.addEventListener("loadedmetadata", doWarmup, { once: true })
    }

    return () => {
      v.removeEventListener("loadedmetadata", doWarmup)
      clearTimeout(warmupTimer)
    }
  }, [loadState])

  // Sync mute state
  useEffect(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    v.muted = muted
  }, [muted])

  // Show unmute hint on first video before interaction
  useEffect(() => {
    if (isActive && !hasInteracted && index === 0) {
      setShowUnmute(true)
    } else {
      setShowUnmute(false)
    }
  }, [isActive, hasInteracted, index])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    if (!hasInteractedRef.current) {
      onInteract()
      v.play().catch(() => undefined)
      return
    }
    if (v.paused) {
      v.play().catch(() => undefined)
    } else {
      v.pause()
    }
  }, [onInteract])

  const handleSeek = useCallback(
    (pct: number) => {
      const v = videoRef.current
      if (!v || duration <= 0) {
        return
      }
      v.currentTime = pct * duration
    },
    [duration]
  )

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    setCurrentTime(v.currentTime)
  }, [])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    onAdvance()
  }, [onAdvance])

  const [scrubbing, setScrubbing] = useState(false)
  const [tooltipText, setTooltipText] = useState<string | null>(null)

  const handleExpandChange = useCallback((expanded: boolean) => {
    setScrubbing(expanded)
  }, [])

  const handleTooltipChange = useCallback((text: string | null) => {
    setTooltipText(text)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    setDuration(v.duration)
  }, [])

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef(index, el)
    },
    [index, registerRef]
  )

  if (!item.r2Key) {
    return null
  }

  const poster = getVideoThumbUrl(item.r2Key)

  return (
    <div
      className="relative flex h-dvh items-center justify-center overflow-hidden bg-black [scroll-snap-align:start] [scroll-snap-stop:always]"
      data-index={index}
      ref={refCallback}
    >
      {/* Blurred background */}
      <div
        className="absolute inset-0 z-0 scale-110 blur-xl brightness-[0.3]"
        style={{
          backgroundImage: `url(${poster})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />

      {/* Video element — always mounted */}
      <video
        className="relative z-10 h-full w-full object-contain [contain:layout_style_paint] [will-change:transform]"
        muted={muted}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        ref={videoRef}
      />

      {/* Poster overlay — fades out when first frame is ready */}
      <div
        className="absolute inset-0 z-20 transition-opacity duration-200"
        style={{
          backgroundImage: `url(${poster})`,
          backgroundPosition: "center",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          opacity: isReady ? 0 : 1,
          pointerEvents: "none",
        }}
      />

      <VideoControls
        currentTime={currentTime}
        duration={duration}
        moments={item.moments}
        muted={muted}
        onExpandChange={handleExpandChange}
        onMuteToggle={onMuteToggle}
        onSeek={handleSeek}
        onTogglePlay={togglePlay}
        onTooltipChange={handleTooltipChange}
        playing={playing}
        showUnmute={showUnmute}
      />

      <VideoActions item={item} />

      <VideoMetadata
        item={item}
        scrubbing={scrubbing}
        tooltipText={tooltipText}
      />
    </div>
  )
}
