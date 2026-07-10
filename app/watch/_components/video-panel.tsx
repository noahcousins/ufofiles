"use client"

import posthog from "posthog-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { useRequireVerified } from "@/components/auth/email-verification-provider"
import { type ClipDraft, ClipEditor } from "@/components/clips/clip-editor"
import { pushClipProgress } from "@/components/clips/clip-progress"
import { toast } from "@/components/ui/toast"
import { useSession } from "@/lib/auth/session-provider"
import { writePendingClip } from "@/lib/clips/pending-clip"
import { getHlsPlaylistUrl, getVideoThumbUrl } from "@/lib/file-url"
import { trpc } from "@/lib/trpc/client"
import { type MomentSource, visibleMoments } from "@/lib/video-moments"
import type { LoadState } from "./preload-window"
import { useHlsPlayer } from "./use-hls-player"
import { VideoActions } from "./video-actions"
import { VideoControls } from "./video-controls"
import { VideoMetadata } from "./video-metadata"

const DEFAULT_CLIP_SECONDS = 15

export interface VideoMoment {
  description: string
  endSeconds: number | null
  id: number
  source: MomentSource
  startSeconds: number
}

export interface MomentTooltip {
  source: MomentSource
  text: string
}

export interface FeedItem {
  agency: string | null
  bookmarkCount: number
  description: string | null
  fileSize: number | null
  id: number
  incidentDate: string | null
  incidentLocation: string | null
  mimeType: string | null
  moments: VideoMoment[]
  r2Key: string | null
  release: { name: string; title: string } | null
  tags: { slug: string; label: string }[]
  title: string
}

interface VideoPanelProps {
  claimVideo: (index: number) => HTMLVideoElement | null
  hasInteracted: boolean
  index: number
  isActive: boolean
  isNext: boolean
  item: FeedItem
  loadState: LoadState
  muted: boolean
  onAdvance: () => void
  onAutoplayMuted: () => void
  onClipEditingChange: (editing: boolean) => void
  onInteract: () => void
  onMuteToggle: () => void
  registerRef: (index: number, el: HTMLDivElement | null) => void
}

export function VideoPanel({
  claimVideo,
  hasInteracted,
  index,
  isActive,
  isNext,
  item,
  loadState,
  muted,
  onAdvance,
  onAutoplayMuted,
  onClipEditingChange,
  onInteract,
  onMuteToggle,
  registerRef,
}: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showUnmute, setShowUnmute] = useState(false)

  // --- Clip mode (ADR-0002 / ADR-0003) ---
  const { data: session } = useSession()
  const openAuth = useAuthDialog()
  const requireVerified = useRequireVerified()
  const createClip = trpc.clips.create.useMutation()
  const utils = trpc.useUtils()
  const [clipMode, setClipMode] = useState(false)
  const [clipDraft, setClipDraft] = useState<ClipDraft | null>(null)
  // Read by the once-attached media listeners below to enforce the loop and
  // suppress auto-advance while editing.
  const clipModeRef = useRef(false)
  clipModeRef.current = clipMode
  const clipDraftRef = useRef<ClipDraft | null>(null)
  clipDraftRef.current = clipDraft

  const viewRecorded = useRef(false)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  const hasInteractedRef = useRef(hasInteracted)
  hasInteractedRef.current = hasInteracted
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const onAutoplayMutedRef = useRef(onAutoplayMuted)
  onAutoplayMutedRef.current = onAutoplayMuted
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance
  const didWarmup = useRef(false)

  const hlsUrl =
    loadState !== "idle" && item.r2Key ? getHlsPlaylistUrl(item.r2Key) : null
  const { isReady } = useHlsPlayer(videoEl, hlsUrl)

  // Claim a pooled <video> element while inside the load window. Pooled
  // elements are recycled across panels so a single user gesture can bless
  // them all for autoplay (see video-pool.ts).
  const inWindow = loadState !== "idle"
  useEffect(() => {
    const holder = holderRef.current
    if (!(inWindow && holder)) {
      return
    }
    const el = claimVideo(index)
    if (!el) {
      return
    }
    holder.appendChild(el)
    videoRef.current = el
    setVideoEl(el)

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      // In clip mode, looping owns the end of the timeline — never advance.
      const d = clipDraftRef.current
      if (clipModeRef.current && d) {
        el.currentTime = d.start
        el.play().catch(() => undefined)
        return
      }
      setPlaying(false)
      onAdvanceRef.current()
    }
    const onTimeUpdate = () => {
      // Loop within the draft bounds while editing.
      const d = clipDraftRef.current
      if (clipModeRef.current && d && el.currentTime >= d.end) {
        el.currentTime = d.start
      }
      setCurrentTime(el.currentTime)
    }
    const onLoadedMetadata = () => setDuration(el.duration)
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onEnded)
    el.addEventListener("timeupdate", onTimeUpdate)
    el.addEventListener("loadedmetadata", onLoadedMetadata)

    return () => {
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onEnded)
      el.removeEventListener("timeupdate", onTimeUpdate)
      el.removeEventListener("loadedmetadata", onLoadedMetadata)
      if (el.parentNode === holder) {
        holder.removeChild(el)
      }
      videoRef.current = null
      setVideoEl(null)
      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }
  }, [inWindow, index, claimVideo])

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

  const tryPlayInner = useCallback((v: HTMLVideoElement) => {
    // Already playing — never disturb it. Re-asserting muted/play on a playing
    // element off-gesture is what iOS punishes by pausing.
    if (!v.paused) {
      return
    }
    v.muted = mutedRef.current
    v.play().catch(() => {
      // Autoplay was rejected. iOS blocks unmuted autoplay outside a user
      // gesture, and the rejection name varies across WebKit builds
      // (NotAllowedError, AbortError, …) — so retry muted on ANY failure.
      // Muted autoplay is always permitted. LEAVE it muted: re-unmuting here
      // (off-gesture) makes iOS pause the video, forcing a manual tap. The user
      // can tap unmute (a real gesture) to restore sound.
      if (v.muted) {
        return
      }
      v.muted = true
      v.play()
        // Tell the feed the element is actually muted so the speaker icon is
        // truthful and later panels skip the doomed unmuted attempt.
        .then(() => onAutoplayMutedRef.current())
        .catch(() => undefined)
    })
  }, [])

  const tryPlay = useCallback(() => {
    const v = videoRef.current
    // Clip mode drives playback itself (loop within bounds) — keep the feed's
    // autoplay from hijacking it.
    if (
      !(v && isActiveRef.current && hasInteractedRef.current) ||
      clipModeRef.current
    ) {
      return
    }

    if (v.readyState < 3) {
      const onReady = () => {
        if (isActiveRef.current && hasInteractedRef.current) {
          tryPlayInner(v)
        }
      }
      v.addEventListener("canplay", onReady, { once: true })
      return
    }

    tryPlayInner(v)
  }, [tryPlayInner])

  // Active/inactive playback control. Muting is handled imperatively inside
  // user gestures (handleMuteToggle/togglePlay), never here — setting muted in
  // an effect runs outside the gesture stack and iOS pauses the video for it.
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

  // Warmup: briefly play the next-up video to prime the decoder. Only the
  // immediate next panel — warming the whole preload window plays several
  // videos at once, which starves the device's limited decoder sessions.
  useEffect(() => {
    const v = videoRef.current
    if (
      !(v && isReady && isNext) ||
      didWarmup.current ||
      isActiveRef.current ||
      // A swipe gesture may have already started this video (playWithinGesture)
      // — warming it up would re-mute and reset it.
      !v.paused
    ) {
      return
    }

    didWarmup.current = true
    v.muted = true

    let warmupTimer: ReturnType<typeof setTimeout> | undefined
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

    return () => {
      clearTimeout(warmupTimer)
    }
  }, [isReady, isNext])

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
    // First tap on the feed: this is a real user gesture, so unmuting here is
    // allowed by iOS. Do it synchronously rather than via state/effect.
    if (!hasInteractedRef.current) {
      onInteract()
      v.muted = false
      v.play().catch(() => undefined)
      return
    }
    if (v.paused) {
      v.play().catch(() => undefined)
    } else {
      v.pause()
    }
  }, [onInteract])

  // Mute toggle must apply to the element synchronously inside the gesture —
  // iOS only honors unmuting that happens in a user-gesture call stack.
  const handleMuteToggle = useCallback(() => {
    const v = videoRef.current
    const next = !mutedRef.current
    if (v) {
      v.muted = next
      if (!next && v.paused) {
        v.play().catch(() => undefined)
      }
    }
    onMuteToggle()
  }, [onMuteToggle])

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

  // Fullscreen the <video> element itself. iOS Safari doesn't support the
  // standard Fullscreen API on arbitrary elements — only the video element,
  // via webkitEnterFullscreen — so fall back to that.
  const handleFullscreen = useCallback(() => {
    const v = videoRef.current
    if (!v) {
      return
    }
    const vEl = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
      return
    }
    if (v.requestFullscreen) {
      v.requestFullscreen().catch(() => vEl.webkitEnterFullscreen?.())
    } else {
      vEl.webkitEnterFullscreen?.()
    }
  }, [])

  const [scrubbing, setScrubbing] = useState(false)
  const [tooltip, setTooltip] = useState<MomentTooltip | null>(null)

  const moments = useMemo(() => visibleMoments(item.moments), [item.moments])

  const handleExpandChange = useCallback((expanded: boolean) => {
    setScrubbing(expanded)
  }, [])

  const handleTooltipChange = useCallback((next: MomentTooltip | null) => {
    setTooltip(next)
  }, [])

  // Enter clip mode: seed bounds at the playhead (+15s), or copy a Moment's
  // bounds if the playhead sits inside one. Pause and park at the in-point.
  const enterClipMode = useCallback(() => {
    const v = videoRef.current
    if (!v || duration <= 0) {
      return
    }
    const now = v.currentTime
    let start = now
    // If the playhead sits inside a Moment, start from the Moment's in-point;
    // otherwise from the playhead. Either way the seed is a short default
    // window the user widens from — never the Moment's full (possibly minutes-
    // long) span.
    const moment = moments.find(
      (m) =>
        m.endSeconds != null && now >= m.startSeconds && now <= m.endSeconds
    )
    if (moment) {
      start = moment.startSeconds
    }
    start = Math.max(0, start)
    let end = Math.min(start + DEFAULT_CLIP_SECONDS, duration)
    end = Math.max(end, start + 1)
    v.pause()
    v.currentTime = start
    setClipDraft({ start, end })
    setClipMode(true)
    onClipEditingChange(true)
  }, [duration, moments, onClipEditingChange])

  const exitClipMode = useCallback(() => {
    setClipMode(false)
    setClipDraft(null)
    onClipEditingChange(false)
  }, [onClipEditingChange])

  // Preview-seek to a handle's frame while dragging.
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
    const d = clipDraftRef.current
    if (!d) {
      return
    }
    const startSeconds = Math.max(0, Math.floor(d.start))
    const endSeconds = Math.min(Math.round(duration), Math.ceil(d.end))
    if (endSeconds <= startSeconds) {
      return
    }
    // Signed-out → park the draft and throw the auth modal (taste-then-convert,
    // ADR-0003). The global replay commits it once they sign up AND verify.
    if (!session?.user) {
      writePendingClip({ fileId: item.id, startSeconds, endSeconds })
      exitClipMode()
      openAuth("signup")
      return
    }
    const runCreate = () =>
      createClip.mutate(
        { fileId: item.id, startSeconds, endSeconds },
        {
          onSuccess: (clip) => {
            utils.invalidate()
            posthog.capture("feed_clip_added", { file_id: item.id })
            if (clip) {
              pushClipProgress({
                clipId: clip.id,
                fileId: clip.fileId,
                startSeconds: clip.startSeconds,
                endSeconds: clip.endSeconds,
                title: item.title,
              })
            }
            exitClipMode()
          },
          onError: (e) => toast(e.message || "Couldn't add clip"),
        }
      )

    // Verified → creates now; signed-in-but-unverified → pops the verify modal
    // and creates on success (the editor stays open behind it).
    requireVerified(runCreate)
  }, [
    duration,
    session,
    item.id,
    item.title,
    createClip,
    utils,
    exitClipMode,
    openAuth,
    requireVerified,
  ])

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

      {/* Pooled video element holder — populated imperatively while inside
          the load window. Idle panels release the element so the browser
          frees the media decoder/MediaSource pipeline; iOS caps simultaneous
          media pipelines (fewer in Low Power Mode). */}
      {inWindow && (
        <div
          className="relative z-10 h-full w-full [contain:layout_style_paint] [will-change:transform]"
          ref={holderRef}
        />
      )}

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

      {clipMode && clipDraft ? (
        // Takeover mode: the editor replaces the normal timeline + chrome.
        <ClipEditor
          currentTime={currentTime}
          draft={clipDraft}
          duration={duration}
          moments={moments}
          onCancel={exitClipMode}
          onChange={setClipDraft}
          onCommit={handleClipCommit}
          onScrub={handleClipScrub}
          onTogglePlay={clipTogglePlay}
          playing={playing}
          submitting={createClip.isPending}
        />
      ) : (
        <>
          <VideoControls
            currentTime={currentTime}
            duration={duration}
            moments={moments}
            muted={muted}
            onExpandChange={handleExpandChange}
            onMuteToggle={handleMuteToggle}
            onSeek={handleSeek}
            onTogglePlay={togglePlay}
            onTooltipChange={handleTooltipChange}
            playing={playing}
            showUnmute={showUnmute}
          />

          <VideoActions
            item={item}
            onFullscreen={handleFullscreen}
            onStartClip={enterClipMode}
          />

          <VideoMetadata
            active={isActive}
            item={item}
            scrubbing={scrubbing && moments.length > 0}
            tooltip={tooltip}
          />
        </>
      )}
    </div>
  )
}
