"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { DebugHud } from "./debug-hud"
import { EndCard } from "./end-card"
import { FeedHeader } from "./feed-header"
import { computeLoadState } from "./preload-window"
import { useScrollDirection } from "./use-scroll-direction"
import { VideoPanel } from "./video-panel"
import { createPooledVideo, VIDEO_POOL_SIZE } from "./video-pool"

export function VideoFeed() {
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2))
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [debugHud] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.search.includes("feeddebug")
  )
  const panelRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const ratioMapRef = useRef<Map<number, number>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollDirection = useScrollDirection(containerRef)

  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const hasInteractedRef = useRef(hasInteracted)
  hasInteractedRef.current = hasInteracted

  // Recycled <video> elements shared by all panels (see video-pool.ts)
  const poolRef = useRef<HTMLVideoElement[] | null>(null)
  const claimVideo = useCallback((index: number) => {
    if (typeof document === "undefined") {
      return null
    }
    if (!poolRef.current) {
      poolRef.current = Array.from(
        { length: VIDEO_POOL_SIZE },
        createPooledVideo
      )
    }
    return poolRef.current[index % VIDEO_POOL_SIZE] ?? null
  }, [])

  // Bless every pooled element the first time a real user gesture is
  // available: play()+pause() inside the gesture permanently lifts iOS's
  // per-element autoplay restriction (incl. Low Power Mode), and the blessing
  // survives src changes — so every later video can autoplay programmatically.
  useEffect(() => {
    const bless = () => {
      const pool = poolRef.current
      if (!pool) {
        return
      }
      const ua = (
        navigator as Navigator & { userActivation?: { isActive: boolean } }
      ).userActivation
      if (ua && !ua.isActive) {
        return
      }
      for (const el of pool) {
        // Skip already-blessed elements, and playing ones (blessing pauses;
        // a playing element gets its turn on a later gesture)
        if (el.dataset.blessed === "1" || !el.paused) {
          continue
        }
        el.dataset.blessed = "1"
        el.play().catch(() => undefined)
        el.pause()
      }
    }
    document.addEventListener("click", bless, true)
    document.addEventListener("touchend", bless, true)
    return () => {
      document.removeEventListener("click", bless, true)
      document.removeEventListener("touchend", bless, true)
    }
  }, [])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.files.videoFeed.useInfiniteQuery(
      { pageSize: 10, seed },
      {
        getNextPageParam: (last) => last.nextCursor,
        initialCursor: 1,
      }
    )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  // Prefetch the next page several panels before the boundary. If the page
  // lands only after the user swipes onto it, the new panel mounts with no
  // gesture in flight and iOS blocks its autoplay — the feed froze on the
  // first video of every page. The scroll sentinel alone fires too late.
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      allItems.length > 0 &&
      allItems.length - activeIndex <= 3
    ) {
      fetchNextPage()
    }
  }, [
    activeIndex,
    allItems.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  const handleInteract = useCallback(() => {
    setHasInteracted(true)
    setMuted(false)
  }, [])

  // iOS rejected unmuted autoplay and the panel fell back to muted playback —
  // mirror that into state so the speaker icon matches the element.
  const handleAutoplayMuted = useCallback(() => {
    setMuted(true)
  }, [])

  // Start playback of a panel's video synchronously inside a user-gesture call
  // stack. iOS WebKit (and Chrome's WKWebView, and Low Power Mode) only allow
  // play() initiated by a real gesture; calling it here both starts the video
  // and permanently blesses the element for future programmatic play().
  const playWithinGesture = useCallback((targetIndex: number) => {
    const video = panelRefs.current
      .get(targetIndex)
      ?.querySelector("video") as HTMLVideoElement | null
    if (!video?.paused) {
      return
    }
    // First gesture doubles as the unmute interaction
    video.muted = hasInteractedRef.current ? mutedRef.current : false
    video.play().catch(() => {
      if (video.muted) {
        return
      }
      video.muted = true
      video.play().catch(() => undefined)
    })
  }, [])

  // Swipe-to-play: the touchend that finishes a swipe IS a user gesture, and
  // scroll-snap-stop:always means one swipe moves exactly one panel — so the
  // swipe target is always activeIndex ± 1. Waiting for IntersectionObserver +
  // effects instead would call play() outside the gesture and get
  // NotAllowedError. (This is how TikTok-style feeds keep autoplay working.)
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let startY: number | null = null
    let fromControls = false

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? null
      fromControls =
        e.target instanceof Element &&
        Boolean(e.target.closest("[role='slider']"))
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (startY === null || fromControls) {
        return
      }
      const dy = (e.changedTouches[0]?.clientY ?? startY) - startY
      startY = null
      if (Math.abs(dy) < 24) {
        return
      }

      const target = activeIndexRef.current + (dy < 0 ? 1 : -1)
      playWithinGesture(target)
      if (!hasInteractedRef.current) {
        handleInteract()
      }

      // Safety net: a weak swipe can snap back, leaving the predicted target
      // playing off-screen. After the snap settles, pause it if it never
      // became active.
      setTimeout(() => {
        if (activeIndexRef.current !== target) {
          panelRefs.current.get(target)?.querySelector("video")?.pause()
        }
      }, 800)
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true })
    container.addEventListener("touchend", onTouchEnd, { passive: true })
    // When native scrolling consumes the touch, iOS can deliver touchcancel
    // instead of touchend — handle both so the swipe is never missed.
    container.addEventListener("touchcancel", onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener("touchstart", onTouchStart)
      container.removeEventListener("touchend", onTouchEnd)
      container.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [playWithinGesture, handleInteract])

  useEffect(() => {
    if (activeIndex > 0 && !hasInteracted) {
      handleInteract()
    }
  }, [activeIndex, hasInteracted, handleInteract])

  // Ratio-map IntersectionObserver — picks the most visible panel
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(entry.target.getAttribute("data-index"))
          if (Number.isNaN(index)) {
            continue
          }
          ratioMapRef.current.set(index, entry.intersectionRatio)
        }

        let bestIdx = -1
        let bestRatio = 0.5
        ratioMapRef.current.forEach((ratio, idx) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestIdx = idx
          }
        })

        if (bestIdx !== -1) {
          setActiveIndex(bestIdx)
        }
      },
      {
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
        root: containerRef.current,
      }
    )

    for (const el of panelRefs.current.values()) {
      observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [])

  const registerPanel = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      const observer = observerRef.current

      const prev = panelRefs.current.get(index)
      if (prev && observer) {
        observer.unobserve(prev)
      }

      if (el) {
        panelRefs.current.set(index, el)
        observer?.observe(el)
      } else {
        panelRefs.current.delete(index)
        ratioMapRef.current.delete(index)
      }
    },
    []
  )

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: "200px" }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Keyboard controls
  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keyboard handler is linear
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
        e.preventDefault()
        playWithinGesture(activeIndex + 1)
        if (!hasInteracted) {
          handleInteract()
        }
        const next = panelRefs.current.get(activeIndex + 1)
        next?.scrollIntoView({ behavior: "smooth" })
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault()
        playWithinGesture(activeIndex - 1)
        if (!hasInteracted) {
          handleInteract()
        }
        const prev = panelRefs.current.get(activeIndex - 1)
        prev?.scrollIntoView({ behavior: "smooth" })
      } else if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, hasInteracted, handleInteract, playWithinGesture])

  const scrollToIndex = useCallback((targetIndex: number) => {
    const el = panelRefs.current.get(targetIndex)
    el?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleShuffle = useCallback(() => {
    setSeed(Math.random().toString(36).slice(2))
    containerRef.current?.scrollTo({
      top: 0,
      behavior: "instant" as ScrollBehavior,
    })
    setActiveIndex(0)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black [scroll-snap-type:y_mandatory]"
      ref={containerRef}
    >
      <div className="relative mx-auto max-w-md">
        {debugHud && <DebugHud />}
        <FeedHeader />

        {allItems.map((item, index) => {
          const loadState = computeLoadState(
            index,
            activeIndex,
            scrollDirection
          )

          return (
            <VideoPanel
              claimVideo={claimVideo}
              hasInteracted={hasInteracted}
              index={index}
              isActive={index === activeIndex}
              isNext={index === activeIndex + 1}
              item={item}
              key={item.id}
              loadState={loadState}
              muted={muted}
              onAdvance={() => scrollToIndex(index + 1)}
              onAutoplayMuted={handleAutoplayMuted}
              onInteract={handleInteract}
              onMuteToggle={() => setMuted((m) => !m)}
              registerRef={registerPanel}
            />
          )
        })}

        {!hasNextPage && allItems.length > 0 && (
          <EndCard onShuffle={handleShuffle} />
        )}

        {hasNextPage && <div className="h-1" ref={sentinelRef} />}

        {isFetchingNextPage && (
          <div className="flex h-dvh items-center justify-center [scroll-snap-align:start]">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}
      </div>
    </div>
  )
}
