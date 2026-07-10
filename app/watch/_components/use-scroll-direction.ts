import { useEffect, useRef, useState } from "react"
import type { ScrollDirection } from "./preload-window"

// Tracks document scroll direction. The feed scrolls the page itself (not an
// inner container) so iOS Safari collapses its toolbar on scroll — so we read
// window scroll position here rather than a container's scrollTop.
export function useScrollDirection(): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("down")
  const lastScrollTop = useRef(0)
  const directionRef = useRef<ScrollDirection>("down")
  const rafId = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        const top = window.scrollY
        const newDir: ScrollDirection =
          top >= lastScrollTop.current ? "down" : "up"
        lastScrollTop.current = top

        if (newDir !== directionRef.current) {
          directionRef.current = newDir
          setDirection(newDir)
        }
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(rafId.current)
    }
  }, [])

  return direction
}
