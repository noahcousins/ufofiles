import { useEffect, useRef, useState } from "react"
import type { ScrollDirection } from "./preload-window"

export function useScrollDirection(
  containerRef: React.RefObject<HTMLDivElement | null>
): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("down")
  const lastScrollTop = useRef(0)
  const directionRef = useRef<ScrollDirection>("down")
  const rafId = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onScroll = () => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        const top = container.scrollTop
        const newDir: ScrollDirection =
          top >= lastScrollTop.current ? "down" : "up"
        lastScrollTop.current = top

        if (newDir !== directionRef.current) {
          directionRef.current = newDir
          setDirection(newDir)
        }
      })
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(rafId.current)
    }
  }, [containerRef])

  return direction
}
