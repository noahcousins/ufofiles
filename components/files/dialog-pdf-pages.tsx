"use client"

import posthog from "posthog-js"
import type React from "react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { getPageCount, loadManifest } from "@/lib/file-cache"
import { getPdfPageUrl } from "@/lib/file-url"
import { cn } from "@/lib/utils"

/** Pages are rendered at 917×1200 (US Letter); used until a real page reports its size. */
export const DEFAULT_PAGE_RATIO = 917 / 1200
/** Pages start loading this far outside the visible part of the scroller. */
const PRELOAD_MARGIN = "150% 0px"
/** Pages loaded straight away, without waiting to scroll near them. */
const EAGER_PAGES = 3
/** Click-to-zoom scale, relative to the normal reading column. */
const ZOOM = 2
/** Widest the reading column gets unzoomed (Tailwind `max-w-3xl`). */
const READING_MAX_WIDTH = 768

interface ZoomAnchor {
  /** Where the click landed on screen, so that spot can stay under the cursor. */
  clientX: number
  clientY: number
  /** The page's width before the change, to scale the transition from. */
  fromWidth: number
  fx: number
  fy: number
  /** The page that was clicked, and where on it (0–1 on each axis). */
  page: HTMLElement
}

/** Page count from the PDF manifest, or null while it loads / for unknown files. */
export function usePdfPageCount(r2Key: string | null) {
  const [count, setCount] = useState(() => (r2Key ? getPageCount(r2Key) : null))

  useEffect(() => {
    if (!r2Key) {
      return
    }
    let cancelled = false
    loadManifest().then(() => {
      if (!cancelled) {
        setCount(getPageCount(r2Key))
      }
    })
    return () => {
      cancelled = true
    }
  }, [r2Key])

  return count
}

function PdfPage({
  page,
  ratio,
  r2Key,
  near,
  onSize,
  pageRef,
}: {
  page: number
  ratio: number
  r2Key: string
  near: boolean
  onSize: (ratio: number) => void
  pageRef: (el: HTMLDivElement | null) => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden shadow-sm",
        !loaded && "animate-pulse bg-muted/40"
      )}
      data-page={page}
      ref={pageRef}
      style={loaded ? undefined : { aspectRatio: ratio }}
    >
      {near && (
        <img
          alt={`Page ${page}`}
          className={cn(
            "block h-auto w-full transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0"
          )}
          decoding="async"
          height={1200}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth && img.naturalHeight) {
              onSize(img.naturalWidth / img.naturalHeight)
            }
            setLoaded(true)
          }}
          src={getPdfPageUrl(r2Key, page)}
          width={917}
        />
      )}
    </div>
  )
}

/**
 * The whole document inside the file viewer: page 1 is the morph target the
 * dialog already renders (passed in as `firstPage`), pages 2..N stack under it
 * and load as they come within reach of the scroller. Nothing past page 1 is
 * mounted until `ready`, so the open animation never competes with them.
 *
 * Single-page files get a fit-to-screen view instead. Until the count arrives
 * we assume the reading layout, since most PDFs have several pages. Both
 * layouts keep page 1 at the same spot in the tree, so when the count arrives
 * only its classes change. Remounting it would restart the shared-layout
 * morph and crossfade the page mid-open.
 */
export function DialogPdfPages({
  r2Key,
  pageCount,
  firstPage,
  ready,
  scrollRef,
}: {
  r2Key: string
  pageCount: number | null
  firstPage: React.ReactNode
  ready: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const firstPageEl = useRef<HTMLDivElement | null>(null)
  const columnRef = useRef<HTMLDivElement | null>(null)
  const multiPage = (pageCount ?? 0) > 1
  // Zoomed column width in px, plus the pane width it was measured against.
  const [zoom, setZoom] = useState<{ width: number; paneWidth: number } | null>(
    null
  )
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null)
  const readingLayout = pageCount !== 1 || zoom !== null
  const lastPage = pageCount ?? 1
  const [near, setNear] = useState<boolean[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [ratio, setRatio] = useState(DEFAULT_PAGE_RATIO)
  const sizedRef = useRef(false)

  const handleSize = useCallback((r: number) => {
    if (!sizedRef.current) {
      sizedRef.current = true
      setRatio(r)
    }
  }, [])

  // Load pages as they approach, and never unload them.
  useEffect(() => {
    const root = scrollRef.current
    if (!(ready && multiPage && root)) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const hits = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.page))
        if (hits.length > 0) {
          setNear((prev) => {
            if (hits.every((p) => prev[p])) {
              return prev
            }
            const next = [...prev]
            for (const p of hits) {
              next[p] = true
            }
            return next
          })
        }
      },
      { root, rootMargin: PRELOAD_MARGIN }
    )
    for (const el of pageEls.current) {
      if (el) {
        observer.observe(el)
      }
    }
    return () => observer.disconnect()
  }, [ready, multiPage, scrollRef])

  // The page under the middle of the scroller is the "current" one.
  useEffect(() => {
    const root = scrollRef.current
    if (!(ready && multiPage && root)) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrentPage(
              Number((entry.target as HTMLElement).dataset.page) || 1
            )
          }
        }
      },
      { root, rootMargin: "-50% 0px -50% 0px" }
    )
    if (firstPageEl.current) {
      observer.observe(firstPageEl.current)
    }
    for (const el of pageEls.current) {
      if (el) {
        observer.observe(el)
      }
    }
    return () => observer.disconnect()
  }, [ready, multiPage, scrollRef])

  // Click a page to zoom in around that spot; click again to zoom back out.
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pane = scrollRef.current
    const page = (e.target as HTMLElement).closest<HTMLElement>("[data-page]")
    if (!(pane && page && columnRef.current?.contains(page))) {
      return
    }
    const rect = page.getBoundingClientRect()
    zoomAnchorRef.current = {
      page,
      fx: (e.clientX - rect.left) / rect.width,
      fy: (e.clientY - rect.top) / rect.height,
      clientX: e.clientX,
      clientY: e.clientY,
      fromWidth: rect.width,
    }
    if (zoom) {
      setZoom(null)
    } else {
      const paneWidth = pane.clientWidth
      setZoom({
        width: Math.min(paneWidth, READING_MAX_WIDTH) * ZOOM,
        paneWidth,
      })
    }
    posthog.capture(zoom ? "pdf_zoomed_out" : "pdf_zoomed_in", {
      page: Number(page.dataset.page),
    })
  }

  // After the zoom re-layout, scroll so the clicked spot is back under the
  // cursor, then scale the column from its old size so it grows/shrinks out
  // of that spot instead of jumping. Runs before paint, so there's no flash.
  // biome-ignore lint/correctness/useExhaustiveDependencies: zoom is the trigger; the anchor lives in a ref
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const pane = scrollRef.current
    const column = columnRef.current
    zoomAnchorRef.current = null
    if (!(anchor && pane && column)) {
      return
    }
    const moved = anchor.page.getBoundingClientRect()
    pane.scrollLeft += moved.left + anchor.fx * moved.width - anchor.clientX
    pane.scrollTop += moved.top + anchor.fy * moved.height - anchor.clientY

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    const landed = anchor.page.getBoundingClientRect()
    const col = column.getBoundingClientRect()
    const origin = `${anchor.clientX - col.left}px ${anchor.clientY - col.top}px`
    column.animate(
      [
        {
          transform: `scale(${anchor.fromWidth / landed.width})`,
          transformOrigin: origin,
        },
        { transform: "scale(1)", transformOrigin: origin },
      ],
      { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" }
    )
  }, [zoom])

  // Esc zooms out first; the next Esc closes the viewer as usual. Capture
  // phase so it runs before the dialog's own Esc handler.
  useEffect(() => {
    if (!zoom) {
      return
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        setZoom(null)
      }
    }
    window.addEventListener("keydown", handleKey, { capture: true })
    return () =>
      window.removeEventListener("keydown", handleKey, { capture: true })
  }, [zoom])

  // PageUp / PageDown jump a whole page (←/→ stay on prev/next file).
  useEffect(() => {
    if (!(ready && multiPage)) {
      return
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "PageDown" && e.key !== "PageUp") {
        return
      }
      const root = scrollRef.current
      if (!root) {
        return
      }
      const target = Math.min(
        Math.max(currentPage + (e.key === "PageDown" ? 1 : -1), 1),
        lastPage
      )
      const el = target === 1 ? firstPageEl.current : pageEls.current[target]
      if (el) {
        e.preventDefault()
        root.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" })
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [ready, multiPage, currentPage, lastPage, scrollRef])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only zoom affordance; keyboard users have PageUp/PageDown and the browser's own zoom
    <div
      className={cn(
        "relative z-10 flex w-full",
        readingLayout
          ? "mx-auto h-fit max-w-3xl shrink-0 flex-col gap-2 self-start px-2 py-4 sm:px-4"
          : "h-full",
        zoom
          ? "[&_[data-page]]:cursor-zoom-out"
          : "[&_[data-page]]:cursor-zoom-in"
      )}
      onClick={handleClick}
      ref={columnRef}
      style={zoom ? { width: zoom.width, maxWidth: "none" } : undefined}
    >
      <div
        className={cn(
          "relative w-full shrink-0",
          readingLayout ? "shadow-sm" : "h-full"
        )}
        data-page={1}
        ref={firstPageEl}
        style={readingLayout ? { aspectRatio: ratio } : undefined}
      >
        {firstPage}
      </div>

      {ready &&
        multiPage &&
        Array.from({ length: lastPage - 1 }, (_, i) => {
          const page = i + 2
          return (
            <PdfPage
              key={page}
              near={page <= EAGER_PAGES || (near[page] ?? false)}
              onSize={handleSize}
              page={page}
              pageRef={(el) => {
                pageEls.current[page] = el
              }}
              r2Key={r2Key}
              ratio={ratio}
            />
          )
        })}

      {multiPage && (
        // Zoomed, the column is wider than the pane, so pin the counter to the
        // pane's visible width (sticky left) to keep it centered on screen.
        <div
          className="pointer-events-none sticky bottom-3 left-0 mt-1 flex justify-center"
          style={zoom ? { width: zoom.paneWidth - 32 } : undefined}
        >
          <div className="rounded-full bg-black/70 px-3 py-1 text-white text-xs tabular-nums backdrop-blur-sm">
            {currentPage} / {lastPage}
          </div>
        </div>
      )}
    </div>
  )
}
