"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const FRAMES = ["⠋", "⠙", "⠚", "⠞", "⠖", "⠦", "⠴", "⠲", "⠳", "⠓"]
const INTERVAL = 80

export function Spinner({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0)
  const raf = useRef<number>(0)
  const last = useRef<number>(0)

  useEffect(() => {
    let running = true
    const tick = (now: number) => {
      if (!running) return
      if (now - last.current >= INTERVAL) {
        last.current = now
        setFrame((f) => (f + 1) % FRAMES.length)
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <span
      className={cn("text-muted-foreground select-none", className)}
      aria-label="Loading"
      role="status"
    >
      {FRAMES[frame]}
    </span>
  )
}
