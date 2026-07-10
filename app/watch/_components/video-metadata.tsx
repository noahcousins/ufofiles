"use client"

import { Hash, MapPin } from "@phosphor-icons/react"
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AgencySeal } from "@/components/files/file-filters"
import { cn } from "@/lib/utils"
import type { FeedItem } from "./video-panel"

// Marquee tuning. Constant scroll SPEED (px/s) keeps long and short titles
// legible at the same pace; the pauses let the viewer read each end before it
// glides back. After a manual drag, wait RESUME_DELAY of stillness before
// gliding back to the start and handing the turn on.
const MARQUEE_SPEED = 28
const MARQUEE_START_DELAY = 2.5
const MARQUEE_END_DELAY = 1.5
const MARQUEE_RESUME_DELAY = 10_000

type MarqueeId = "title" | "tags"
// Turn order — title scrolls first, then tags.
const MARQUEE_ORDER: MarqueeId[] = ["title", "tags"]

interface MarqueeTurn {
  id: MarqueeId | null
  nonce: number
}
interface MarqueeScheduler {
  advance: (id: MarqueeId) => void
  reportOverflow: (id: MarqueeId, has: boolean) => void
  seize: (id: MarqueeId) => void
}

// Coordinates the title/tags marquees so only one scrolls at a time. Holds the
// current turn plus a nonce (bumped on every grant so the same marquee can be
// re-triggered to loop). `nonce` is what lets a lone overflowing marquee keep
// looping: advance() re-grants the same id with a fresh nonce.
function useMarqueeScheduler(active: boolean): {
  turn: MarqueeTurn
  sched: MarqueeScheduler
} {
  const [turn, setTurn] = useState<MarqueeTurn>({ id: null, nonce: 0 })
  const turnRef = useRef(turn)
  turnRef.current = turn
  const activeRef = useRef(active)
  activeRef.current = active
  const overflowRef = useRef<Record<MarqueeId, boolean>>({
    title: false,
    tags: false,
  })

  const grant = useCallback((id: MarqueeId | null) => {
    setTurn((t) => ({ id, nonce: t.nonce + 1 }))
  }, [])

  const candidates = useCallback(
    () => MARQUEE_ORDER.filter((id) => overflowRef.current[id]),
    []
  )

  const reportOverflow = useCallback(
    (id: MarqueeId, has: boolean) => {
      if (overflowRef.current[id] === has) {
        return
      }
      overflowRef.current[id] = has
      const cur = turnRef.current.id
      if (activeRef.current && cur === null && has) {
        grant(id)
      } else if (cur === id && !has) {
        grant(candidates()[0] ?? null)
      }
    },
    [grant, candidates]
  )

  const advance = useCallback(
    (from: MarqueeId) => {
      // Ignore a stale hand-off from a marquee that no longer holds the turn.
      if (turnRef.current.id !== from) {
        return
      }
      const cand = candidates()
      if (cand.length === 0) {
        grant(null)
        return
      }
      const i = cand.indexOf(from)
      grant(cand[(i + 1) % cand.length])
    },
    [grant, candidates]
  )

  const seize = useCallback((id: MarqueeId) => grant(id), [grant])

  useEffect(() => {
    if (!active) {
      grant(null)
      return
    }
    if (turnRef.current.id === null) {
      const cand = candidates()
      if (cand.length > 0) {
        grant(cand[0])
      }
    }
  }, [active, grant, candidates])

  const sched = useMemo(
    () => ({ reportOverflow, advance, seize }),
    [reportOverflow, advance, seize]
  )

  return { turn, sched }
}

// Drives one marquee: measures overflow, reports it up, runs the ping-pong
// scroll only when it's this marquee's turn, and lets the viewer drag to
// interrupt (10s of stillness then glides back to the start and resumes).
function useMarquee<C extends HTMLElement, I extends HTMLElement>(
  id: MarqueeId,
  active: boolean,
  turn: MarqueeTurn,
  sched: MarqueeScheduler
) {
  const { reportOverflow, advance, seize } = sched
  const containerRef = useRef<C>(null)
  const innerRef = useRef<I>(null)
  const x = useMotionValue(0)
  const [overflow, setOverflow] = useState(0)
  const [interrupted, setInterrupted] = useState(false)
  // The auto scroll/yield animation, vs. the post-drag reset — kept apart so a
  // re-measure while the viewer is idle can't cancel the pending reset.
  const autoRef = useRef<ReturnType<typeof animate> | null>(null)
  const resetRef = useRef<ReturnType<typeof animate> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const inner = innerRef.current
      if (!(container && inner)) {
        return
      }
      setOverflow(Math.max(0, inner.scrollWidth - container.clientWidth))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) {
      ro.observe(containerRef.current)
    }
    if (innerRef.current) {
      ro.observe(innerRef.current)
    }
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    reportOverflow(id, overflow > 0)
  }, [overflow, id, reportOverflow])

  const isTurn = turn.id === id

  // biome-ignore lint/correctness/useExhaustiveDependencies: turn.nonce re-triggers a fresh cycle when the turn is (re)granted
  useEffect(() => {
    autoRef.current?.stop()
    if (!active) {
      // Left the slide — drop any pending resume so the next visit starts clean.
      resetRef.current?.stop()
      clearTimeout(timerRef.current)
      setInterrupted(false)
      x.set(0)
      return
    }
    // While the viewer is dragging / waiting out the resume delay, leave the
    // position untouched.
    if (interrupted) {
      return
    }
    if (!isTurn || overflow <= 0) {
      // Not our turn — sit at the start so only the turn-holder is offset.
      autoRef.current = animate(x, 0, { duration: 0.4, ease: "easeOut" })
      return
    }
    const travel = overflow / MARQUEE_SPEED
    const total = MARQUEE_START_DELAY + travel + MARQUEE_END_DELAY + travel
    autoRef.current = animate(x, [0, 0, -overflow, -overflow, 0], {
      duration: total,
      times: [
        0,
        MARQUEE_START_DELAY / total,
        (MARQUEE_START_DELAY + travel) / total,
        (MARQUEE_START_DELAY + travel + MARQUEE_END_DELAY) / total,
        1,
      ],
      ease: "linear",
      onComplete: () => advance(id),
    })
    return () => autoRef.current?.stop()
  }, [active, isTurn, overflow, interrupted, turn.nonce, x, advance, id])

  const handleDragStart = useCallback(() => {
    autoRef.current?.stop()
    resetRef.current?.stop()
    clearTimeout(timerRef.current)
    setInterrupted(true)
    // Grab the turn so the other marquee stops scrolling while we read this one.
    if (turn.id !== id) {
      seize(id)
    }
  }, [turn.id, id, seize])

  const handleDragEnd = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      resetRef.current = animate(x, 0, {
        duration: 0.5,
        ease: "easeInOut",
        onComplete: () => {
          setInterrupted(false)
          advance(id)
        },
      })
    }, MARQUEE_RESUME_DELAY)
  }, [x, advance, id])

  const draggable = overflow > 0
  const dragProps = {
    drag: draggable ? ("x" as const) : false,
    dragConstraints: { left: -overflow, right: 0 },
    dragElastic: 0.05,
    dragMomentum: false,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    style: { x },
  }

  return { containerRef, innerRef, draggable, dragProps }
}

// Single-line title that scrolls end-to-end and back only when the text is
// wider than its container. Fits-on-one-line titles render static.
function MarqueeTitle({
  active,
  text,
  turn,
  sched,
}: {
  active: boolean
  text: string
  turn: MarqueeTurn
  sched: MarqueeScheduler
}) {
  const { containerRef, innerRef, draggable, dragProps } = useMarquee<
    HTMLHeadingElement,
    HTMLSpanElement
  >("title", active, turn, sched)

  return (
    <h2
      className="overflow-hidden font-medium text-sm text-white leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
      ref={containerRef}
    >
      <motion.span
        className={cn(
          "block w-max whitespace-nowrap will-change-transform",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        ref={innerRef}
        {...dragProps}
      >
        {text}
      </motion.span>
    </h2>
  )
}

// Single-line tag row that scrolls the same way when the tags overrun the
// container width.
function MarqueeTags({
  active,
  tags,
  turn,
  sched,
}: {
  active: boolean
  tags: FeedItem["tags"]
  turn: MarqueeTurn
  sched: MarqueeScheduler
}) {
  const { containerRef, innerRef, draggable, dragProps } = useMarquee<
    HTMLDivElement,
    HTMLDivElement
  >("tags", active, turn, sched)

  return (
    <div className="overflow-hidden" ref={containerRef}>
      <motion.div
        className={cn(
          "flex w-max gap-1.5 will-change-transform",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        ref={innerRef}
        {...dragProps}
      >
        {tags.map((tag) => (
          <a
            className="flex shrink-0 items-center gap-0.5 rounded-none bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
            href={`/?tag=${encodeURIComponent(tag.slug)}`}
            key={tag.slug}
            onClick={(e) => e.stopPropagation()}
          >
            <Hash className="size-2.5" weight="bold" />
            {tag.label}
          </a>
        ))}
      </motion.div>
    </div>
  )
}

interface VideoMetadataProps {
  active?: boolean
  item: FeedItem
  scrubbing?: boolean
  tooltipText?: string | null
}

export function VideoMetadata({
  active,
  item,
  scrubbing,
  tooltipText,
}: VideoMetadataProps) {
  const { turn, sched } = useMarqueeScheduler(active ?? false)

  return (
    <motion.div
      animate={{ y: scrubbing ? -14 : 0 }}
      className="absolute right-0 bottom-10 left-0 z-20"
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <div className="pointer-events-none absolute inset-0 -bottom-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="relative max-w-[75%] space-y-1.5 px-4">
        <AnimatePresence>
          {tooltipText && (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mb-1.5 font-mono text-[11px] text-white/90 leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 4 }}
              key="tooltip"
              transition={{ duration: 0.15 }}
            >
              {tooltipText}
            </motion.p>
          )}
        </AnimatePresence>
        {item.agency && (
          <a
            className="mb-1.5 flex w-fit items-center gap-1.5 font-mono text-[11px] text-white/70 hover:text-white"
            href={`/?agency=${encodeURIComponent(item.agency)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <AgencySeal agency={item.agency} />
            {item.agency}
          </a>
        )}
        <MarqueeTitle
          active={active ?? false}
          sched={sched}
          text={item.title}
          turn={turn}
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.release && (
            <a
              className="rounded-none border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80 uppercase tracking-wide backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
              href={`/?release=${encodeURIComponent(item.release.name)}`}
              onClick={(e) => e.stopPropagation()}
            >
              {item.release.title}
            </a>
          )}
          {item.incidentDate && item.incidentDate !== "N/A" && (
            <span className="font-mono text-[11px] text-white/60">
              {item.incidentDate}
            </span>
          )}
        </div>
        {item.incidentLocation && item.incidentLocation !== "N/A" && (
          <div className="flex w-fit items-center gap-1 font-mono text-[11px] text-white/60">
            <MapPin className="size-3 shrink-0" weight="fill" />
            {item.incidentLocation}
          </div>
        )}
        {item.tags.length > 0 && (
          <MarqueeTags
            active={active ?? false}
            sched={sched}
            tags={item.tags}
            turn={turn}
          />
        )}
      </div>
    </motion.div>
  )
}
