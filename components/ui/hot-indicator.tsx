"use client"

import { FireIcon } from "@phosphor-icons/react"

function formatViewCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}m`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

const FLAME_STYLES: Record<
  number,
  { color: string; glow?: string; animate?: boolean }
> = {
  1: { color: "text-orange-400/60" },
  2: { color: "text-orange-400" },
  3: {
    color: "text-orange-500",
    glow: "drop-shadow(0 0 3px rgb(249 115 22 / 0.4))",
  },
  4: {
    color: "text-red-500",
    glow: "drop-shadow(0 0 6px rgb(239 68 68 / 0.5))",
    animate: true,
  },
}

export function HotIndicator({
  hotScore,
  views,
  recentViews,
}: {
  hotScore: number
  views: number
  recentViews: number
}) {
  if (hotScore === 0 && views === 0) {
    return null
  }

  const style = FLAME_STYLES[hotScore]

  return (
    <div className="inline-flex items-center gap-0.5">
      {style && (
        <FireIcon
          className={`size-3.5 ${style.color} ${style.animate ? "animate-pulse" : ""}`}
          style={style.glow ? { filter: style.glow } : undefined}
        />
      )}
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {formatViewCount(views)} view{views === 1 ? "" : "s"}
      </span>
    </div>
  )
}
