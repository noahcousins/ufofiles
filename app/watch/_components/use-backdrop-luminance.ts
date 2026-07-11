"use client"

import { useEffect, useRef, useState } from "react"

const SAMPLE_INTERVAL_MS = 500
const SAMPLE_SIZE = 24
// Hysteresis: flip to "light" above ENTER, back to "dark" below EXIT — a gap
// wide enough that a frame hovering at the cutoff doesn't flicker the text.
const LIGHT_ENTER = 0.62
const LIGHT_EXIT = 0.52

/**
 * The part of the video's source frame that sits behind `el`, in source-pixel
 * coordinates, accounting for object-contain letterboxing. `null` when the
 * element lies entirely over letterbox, `undefined` when nothing is measurable
 * yet.
 */
function sourceRectBehind(video: HTMLVideoElement, el: HTMLElement) {
  const vr = video.getBoundingClientRect()
  if (vr.width === 0 || vr.height === 0) {
    return
  }
  const scale = Math.min(
    vr.width / video.videoWidth,
    vr.height / video.videoHeight
  )
  const contentLeft = vr.left + (vr.width - video.videoWidth * scale) / 2
  const contentTop = vr.top + (vr.height - video.videoHeight * scale) / 2

  const rr = el.getBoundingClientRect()
  const left = Math.max(rr.left, contentLeft)
  const top = Math.max(rr.top, contentTop)
  const right = Math.min(rr.right, contentLeft + video.videoWidth * scale)
  const bottom = Math.min(rr.bottom, contentTop + video.videoHeight * scale)
  if (right - left < 1 || bottom - top < 1) {
    return null
  }

  return {
    sx: (left - contentLeft) / scale,
    sy: (top - contentTop) / scale,
    sw: (right - left) / scale,
    sh: (bottom - top) / scale,
  }
}

/** Mean Rec. 709 relative luminance of the canvas contents, 0–1. */
function averageLuminance(ctx: CanvasRenderingContext2D) {
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  return sum / (data.length / 4) / 255
}

/**
 * One pass over every keyed region: sample the frame behind each and apply
 * per-key hysteresis against `prev`. Returns the next map, or null when
 * nothing flipped (so the caller can skip the state update). Throws on a
 * CORS-tainted canvas — the caller handles that once for all regions.
 */
function readRegions(
  video: HTMLVideoElement,
  container: HTMLElement,
  ctx: CanvasRenderingContext2D,
  prev: Record<string, boolean>
): Record<string, boolean> | null {
  const next: Record<string, boolean> = {}
  let changed = false

  for (const el of container.querySelectorAll<HTMLElement>(
    "[data-luminance-key]"
  )) {
    const key = el.dataset.luminanceKey
    if (!key) {
      continue
    }

    const rect = sourceRectBehind(video, el)
    let luminance: number | undefined
    if (rect === null) {
      // Entirely over letterbox — the panel behind the video is near-black.
      luminance = 0
    } else if (rect) {
      ctx.drawImage(
        video,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        0,
        0,
        SAMPLE_SIZE,
        SAMPLE_SIZE
      )
      luminance = averageLuminance(ctx)
    }

    const was = prev[key] ?? false
    // Unmeasurable this tick (zero-size rects mid-layout) — keep the last value.
    let is = was
    if (luminance !== undefined) {
      is = was ? luminance > LIGHT_EXIT : luminance > LIGHT_ENTER
    }
    next[key] = is
    if (is !== was) {
      changed = true
    }
  }

  return changed ? next : null
}

/**
 * Samples the video pixels behind each `[data-luminance-key]` element inside
 * `region` a couple of times per second, and reports per key whether they're
 * light enough that white overlay text would be unreadable — so elements over
 * bright content flip dark while siblings over letterbox stay white. If the
 * canvas is CORS-tainted (native HLS without CORS access) sampling stops for
 * good and every key stays `false` — the existing white-on-dark styling.
 */
export function useBackdropLuminance(
  video: HTMLVideoElement | null,
  region: React.RefObject<HTMLElement | null>,
  enabled: boolean
): Record<string, boolean> {
  const [light, setLight] = useState<Record<string, boolean>>({})
  const lightRef = useRef<Record<string, boolean>>({})
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const taintedRef = useRef(false)

  useEffect(() => {
    if (!(video && enabled)) {
      return
    }

    const sample = () => {
      const container = region.current
      if (
        !container ||
        taintedRef.current ||
        video.readyState < 2 ||
        !video.videoWidth
      ) {
        return
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas")
        canvasRef.current.width = SAMPLE_SIZE
        canvasRef.current.height = SAMPLE_SIZE
      }
      const ctx = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      })
      if (!ctx) {
        return
      }

      try {
        const next = readRegions(video, container, ctx, lightRef.current)
        if (next) {
          lightRef.current = next
          setLight(next)
        }
      } catch {
        taintedRef.current = true
      }
    }

    sample()
    const id = setInterval(sample, SAMPLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [video, enabled, region])

  return light
}
