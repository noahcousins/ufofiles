"use client"

import { useEffect, useRef, useState } from "react"

// Temporary diagnostic overlay for the iOS autoplay bug. Enabled by adding
// ?feeddebug=1 to /watch. Logs every play() call (with user-activation state),
// every rejection (with error name), and live stats for the active video.
// Remove once the device bug is confirmed fixed.

interface LogLine {
  id: number
  text: string
}

const MAX_LINES = 14

export function DebugHud() {
  const [lines, setLines] = useState<LogLine[]>([])
  const [stats, setStats] = useState("")
  const idRef = useRef(0)

  useEffect(() => {
    const push = (text: string) => {
      idRef.current += 1
      const id = idRef.current
      const ts = new Date().toISOString().slice(14, 23)
      setLines((prev) => [
        ...prev.slice(-(MAX_LINES - 1)),
        { id, text: `${ts} ${text}` },
      ])
    }

    const idxOf = (el: EventTarget | null) => {
      const panel = el instanceof Element ? el.closest("[data-index]") : null
      return panel?.getAttribute("data-index") ?? "?"
    }

    const activation = () => {
      const ua = (
        navigator as Navigator & {
          userActivation?: { isActive: boolean; hasBeenActive: boolean }
        }
      ).userActivation
      if (!ua) {
        return "?"
      }
      return ua.isActive ? "ACT" : "off"
    }

    const orig = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      const idx = idxOf(this)
      push(
        `play #${idx} ${activation()} mut=${this.muted ? 1 : 0} rs=${this.readyState}`
      )
      const p = orig.apply(this, args)
      p?.then(
        () => push(`ok   #${idx}`),
        (e: Error) => push(`REJ  #${idx} ${e.name}`)
      )
      return p
    }

    const onEvt = (e: Event) => {
      if (!(e.target instanceof HTMLMediaElement)) {
        return
      }
      let detail = ""
      if (e.type === "error" && e.target.error) {
        detail = ` code=${e.target.error.code}`
      }
      push(`${e.type} #${idxOf(e.target)}${detail}`)
    }
    const types = ["error", "stalled", "waiting", "pause"]
    for (const t of types) {
      document.addEventListener(t, onEvt, true)
    }

    const onTouch = (e: Event) => {
      push(`${e.type} ${activation()}`)
    }
    document.addEventListener("touchend", onTouch, true)
    document.addEventListener("touchcancel", onTouch, true)

    const ticker = setInterval(() => {
      const panels = [...document.querySelectorAll("[data-index]")]
      const vh = window.innerHeight
      const active = panels.find(
        (p) => Math.abs(p.getBoundingClientRect().top) < vh / 2
      )
      const v = active?.querySelector("video")
      const idx = active?.getAttribute("data-index") ?? "?"
      const nVid = document.querySelectorAll("video").length
      if (v) {
        setStats(
          `#${idx} ${v.paused ? "PAUSED" : "playing"} mut=${v.muted ? 1 : 0} rs=${v.readyState} net=${v.networkState} t=${v.currentTime.toFixed(1)} err=${v.error?.code ?? "-"} | vids=${nVid} panels=${panels.length}`
        )
      } else {
        setStats(`#${idx} NO VIDEO | vids=${nVid} panels=${panels.length}`)
      }
    }, 500)

    return () => {
      HTMLMediaElement.prototype.play = orig
      for (const t of types) {
        document.removeEventListener(t, onEvt, true)
      }
      document.removeEventListener("touchend", onTouch, true)
      document.removeEventListener("touchcancel", onTouch, true)
      clearInterval(ticker)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed top-12 left-1 z-[100] max-w-[95%] bg-black/75 p-1 font-mono text-[9px] text-green-400 leading-[11px]">
      <div className="text-yellow-300">{stats}</div>
      {lines.map((l) => (
        <div key={l.id}>{l.text}</div>
      ))}
    </div>
  )
}
