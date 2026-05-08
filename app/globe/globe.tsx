"use client"

import type { Marker } from "cobe"
import createGlobe from "cobe"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SiteHeader } from "@/app/files/site-header"
import { geocodeLocation } from "@/lib/geo/locations"
import { trpc } from "@/lib/trpc/client"

interface MarkerMeta {
  baseSize: number
  count: number
  id: string
  lat: number
  lng: number
  name: string
}

function toMarkerId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const toRad = (d: number) => (d * Math.PI) / 180

function angularDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 180) / Math.PI
}

const HIT_RADIUS = 12

const SCALE = 0.75
const AUTO_SPEED = 0.002

function screenToLatLng(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  phi: number,
  theta: number
): { lat: number; lng: number } | null {
  const rect = canvas.getBoundingClientRect()
  const aspect = rect.width / rect.height

  const sx = (clientX - rect.left) / rect.width
  const sy = (clientY - rect.top) / rect.height

  const c = ((sx * 2 - 1) * aspect) / SCALE
  const s = (1 - 2 * sy) / SCALE

  const r2 = c * c + s * s
  if (r2 > 0.64) {
    return null
  }

  const rz = Math.sqrt(0.64 - r2)

  // Rx(-θ)
  const ct = Math.cos(theta)
  const st = Math.sin(theta)
  const x1 = c
  const y1 = ct * s + st * rz
  const z1 = -st * s + ct * rz

  // Ry(-φ)
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)
  const wx = cp * x1 - sp * z1
  const wy = y1
  const wz = sp * x1 + cp * z1

  const R = Math.sqrt(wx * wx + wy * wy + wz * wz)
  const lat = Math.asin(Math.max(-1, Math.min(1, wy / R))) * (180 / Math.PI)
  const lng = Math.atan2(-wz, wx) * (180 / Math.PI)

  return { lat, lng }
}

function findNearestMarker(
  lat: number,
  lng: number,
  markers: MarkerMeta[]
): MarkerMeta | null {
  let bestDist = Number.POSITIVE_INFINITY
  let best: MarkerMeta | null = null
  for (const m of markers) {
    const dist = angularDistance(lat, lng, m.lat, m.lng)
    if (dist < bestDist) {
      bestDist = dist
      best = m
    }
  }
  return best && bestDist <= HIT_RADIUS ? best : null
}

function latLngToScreen(
  lat: number,
  lng: number,
  canvas: HTMLCanvasElement,
  phi: number,
  theta: number
): { x: number; y: number; z: number } | null {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180

  const ux = Math.cos(latRad) * Math.cos(lngRad)
  const uy = Math.sin(latRad)
  const uz = -Math.cos(latRad) * Math.sin(lngRad)

  // Ry(phi)
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)
  const x1 = cp * ux + sp * uz
  const y1 = uy
  const z1 = -sp * ux + cp * uz

  // Rx(theta)
  const ct = Math.cos(theta)
  const st = Math.sin(theta)
  const x2 = x1
  const y2 = ct * y1 - st * z1
  const z2 = st * y1 + ct * z1

  if (z2 < 0) {
    return null
  }

  const rect = canvas.getBoundingClientRect()
  const aspect = rect.width / rect.height

  const px = ((x2 * 0.8 * SCALE) / aspect + 1) / 2
  const py = (1 - y2 * 0.8 * SCALE) / 2

  return { x: px * rect.width, y: py * rect.height, z: z2 }
}

function buildMarkers(meta: MarkerMeta[]): Marker[] {
  return meta.map((m) => ({
    location: [m.lat, m.lng] as [number, number],
    size: 0.005,
    id: m.id,
  }))
}

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phiRef = useRef(0)
  const thetaRef = useRef(0.15)
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)
  const markerMetaRef = useRef<MarkerMeta[]>([])
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const hoveredRef = useRef<string | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const router = useRouter()

  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null)

  const [locationData] = trpc.files.locations.useSuspenseQuery()

  const markerMeta = useMemo<MarkerMeta[]>(() => {
    if (!locationData) {
      return []
    }
    const maxCount = Math.max(...locationData.map((d) => d.count), 1)
    const meta: MarkerMeta[] = []

    for (const item of locationData) {
      if (!item.location) {
        continue
      }
      const coords = geocodeLocation(item.location)
      if (!coords) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[globe] Unmapped location: "${item.location}" (${item.count} incidents)`
          )
        }
        continue
      }
      meta.push({
        name: item.location,
        id: toMarkerId(item.location),
        lat: coords[0],
        lng: coords[1],
        baseSize: 0.04 + (item.count / maxCount) * 0.12,
        count: item.count,
      })
    }
    return meta
  }, [locationData])

  markerMetaRef.current = markerMeta

  const pushMarkers = useCallback(() => {
    globeRef.current?.update({
      markers: buildMarkers(markerMetaRef.current),
    })
  }, [])

  const getGlobeConfig = useCallback(
    (dark: boolean) => ({
      dark: dark ? 1 : 0,
      diffuse: dark ? 1.2 : 3,
      mapSamples: 36_000,
      mapBrightness: dark ? 4 : 6,
      mapBaseBrightness: dark ? 0.1 : 0.01,
      baseColor: (dark ? [0.15, 0.15, 0.15] : [1, 1, 1]) as [
        number,
        number,
        number,
      ],
      markerColor: (dark ? [0.15, 0.15, 0.15] : [1, 1, 1]) as [
        number,
        number,
        number,
      ],
      glowColor: (dark ? [0.05, 0.05, 0.05] : [1, 1, 1]) as [
        number,
        number,
        number,
      ],
    }),
    []
  )

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const themeConfig = getGlobeConfig(isDark)

    let pointerDown = false
    let pointerX = 0
    let pointerY = 0
    let totalDragDist = 0
    let dragVelocity = 0
    const DRAG_SENSITIVITY = 0.005
    const DRAG_SENSITIVITY_Y = 0.003
    const FRICTION = 0.95
    const CLICK_THRESHOLD = 4

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: canvas.clientWidth * 2,
      height: canvas.clientHeight * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      ...themeConfig,
      markers: buildMarkers(markerMetaRef.current),
      opacity: 0.85,
      scale: SCALE,
      offset: [0, 0] as [number, number],
    })

    globeRef.current = globe

    const wrapper = canvas.parentElement as HTMLElement

    const updateHover = (clientX: number, clientY: number) => {
      const hit = screenToLatLng(
        clientX,
        clientY,
        canvas,
        phiRef.current,
        thetaRef.current
      )
      let name: string | null = null
      if (hit) {
        const m = findNearestMarker(hit.lat, hit.lng, markerMetaRef.current)
        name = m?.name ?? null
      }
      if (name !== hoveredRef.current) {
        hoveredRef.current = name
        setHoveredLocation(name)
        wrapper.style.cursor = name ? "pointer" : "grab"
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return
      }

      pointerDown = true
      pointerX = e.clientX
      pointerY = e.clientY
      totalDragDist = 0
      dragVelocity = 0
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) {
        updateHover(e.clientX, e.clientY)
        return
      }

      const dx = e.clientX - pointerX
      const dy = e.clientY - pointerY
      totalDragDist += Math.abs(dx) + Math.abs(dy)
      pointerX = e.clientX
      pointerY = e.clientY

      if (totalDragDist > CLICK_THRESHOLD) {
        wrapper.style.cursor = "grabbing"
        if (hoveredRef.current) {
          hoveredRef.current = null
          setHoveredLocation(null)
        }
        phiRef.current += dx * DRAG_SENSITIVITY
        thetaRef.current = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, thetaRef.current - dy * DRAG_SENSITIVITY_Y)
        )
        dragVelocity = dx * DRAG_SENSITIVITY
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) {
        return
      }
      const wasClick = totalDragDist <= CLICK_THRESHOLD
      pointerDown = false
      wrapper.style.cursor = hoveredRef.current ? "pointer" : "grab"

      if (wasClick) {
        const hit = screenToLatLng(
          e.clientX,
          e.clientY,
          canvas,
          phiRef.current,
          thetaRef.current
        )
        if (!hit) {
          return
        }

        const m = findNearestMarker(hit.lat, hit.lng, markerMetaRef.current)
        if (m) {
          setSelectedLocation(m.name)
          const name = m.name
          router.push(`/?search=${encodeURIComponent(name)}`)
        }
      }
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    wrapper.style.cursor = "grab"

    let rafId: number
    const animate = () => {
      if (!pointerDown && Math.abs(dragVelocity) > 0.000_01) {
        phiRef.current += dragVelocity
        dragVelocity *= FRICTION
      } else if (!(pointerDown || hoveredRef.current)) {
        phiRef.current += AUTO_SPEED
      }
      globe.update({ phi: phiRef.current, theta: thetaRef.current })

      for (const m of markerMetaRef.current) {
        const el = markerElsRef.current.get(m.id)
        if (!el) {
          continue
        }
        const pos = latLngToScreen(
          m.lat,
          m.lng,
          canvas,
          phiRef.current,
          thetaRef.current
        )
        if (pos) {
          const depthScale = 0.4 + pos.z * 0.6
          el.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${depthScale})`
          el.style.opacity = String(Math.min(1, pos.z * 4))
        } else {
          el.style.opacity = "0"
        }
      }

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    const handleResize = () => {
      globe.update({
        width: canvas.clientWidth * 2,
        height: canvas.clientHeight * 2,
      })
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("resize", handleResize)
      globe.destroy()
      globeRef.current = null
    }
  }, [isDark, getGlobeConfig, router])

  useEffect(() => {
    if (markerMeta.length > 0) {
      pushMarkers()
    }
  }, [markerMeta, pushMarkers])

  const hoveredMeta = hoveredLocation
    ? markerMeta.find((m) => m.name === hoveredLocation)
    : null

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <canvas
        className="absolute inset-0 h-full w-full"
        ref={canvasRef}
        style={{ display: "block", touchAction: "none" }}
      />

      {markerMeta.map((m) => {
        const isHighlighted = m.name === (hoveredLocation ?? selectedLocation)
        const countScale = (m.baseSize - 0.04) / 0.12 // 0–1
        const emojiSize = isHighlighted
          ? 32 + countScale * 64
          : 24 + countScale * 52
        return (
          <div
            className="pointer-events-none absolute top-0 left-0 z-[15] will-change-transform"
            key={m.id}
            ref={(el) => {
              if (el) {
                markerElsRef.current.set(m.id, el)
              } else {
                markerElsRef.current.delete(m.id)
              }
            }}
            style={{ opacity: 0 }}
          >
            <div
              className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{
                fontSize: `${emojiSize}px`,
                lineHeight: 1,
                transition: "font-size 0.2s",
              }}
            >
              🛸
            </div>
            {isHighlighted && (
              <div className="-translate-x-1/2 whitespace-nowrap rounded bg-foreground/80 px-1.5 py-0.5 text-center font-medium text-[10px] text-background backdrop-blur-sm">
                {m.name}
                <span className="ml-1 text-background/50">({m.count})</span>
              </div>
            )}
          </div>
        )
      })}

      <div className="absolute inset-x-0 top-0 z-40">
        <SiteHeader />
      </div>

      {hoveredMeta && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center">
          <div className="rounded-full bg-foreground/10 px-4 py-2 font-medium text-foreground text-sm backdrop-blur-sm">
            {hoveredMeta.name}
            <span className="ml-1.5 text-muted-foreground">
              — {hoveredMeta.count} file{hoveredMeta.count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {selectedLocation && !hoveredLocation && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center">
          <div className="animate-pulse rounded-full bg-foreground/10 px-4 py-2 font-medium text-foreground text-sm backdrop-blur-sm">
            {selectedLocation} →
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-background via-background/60 to-transparent pt-16 pb-6 text-center">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-muted-foreground/70 text-xs">
            Select a marker to view files from that location
          </p>
        </div>
      </div>
    </div>
  )
}
