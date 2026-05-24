"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { EndCard } from "./end-card"
import { FeedHeader } from "./feed-header"
import { computeLoadState } from "./preload-window"
import { useScrollDirection } from "./use-scroll-direction"
import { VideoPanel } from "./video-panel"

export function VideoFeed() {
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2))
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const panelRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const ratioMapRef = useRef<Map<number, number>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollDirection = useScrollDirection(containerRef)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.files.videoFeed.useInfiniteQuery(
      { pageSize: 5, seed },
      {
        getNextPageParam: (last) => last.nextCursor,
        initialCursor: 1,
      }
    )

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  const handleInteract = useCallback(() => {
    setHasInteracted(true)
    setMuted(false)
  }, [])

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
        if (!hasInteracted) {
          handleInteract()
        }
        const next = panelRefs.current.get(activeIndex + 1)
        next?.scrollIntoView({ behavior: "smooth" })
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault()
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
  }, [activeIndex, hasInteracted, handleInteract])

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
        <FeedHeader />

        {allItems.map((item, index) => {
          const loadState = computeLoadState(
            index,
            activeIndex,
            scrollDirection
          )

          return (
            <VideoPanel
              hasInteracted={hasInteracted}
              index={index}
              isActive={index === activeIndex}
              item={item}
              key={item.id}
              loadState={loadState}
              muted={muted}
              onAdvance={() => scrollToIndex(index + 1)}
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
