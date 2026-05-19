import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const CALLOUT_STYLES: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  info: {
    border: "border-l-blue-400",
    bg: "bg-blue-400/5",
    text: "text-blue-400",
  },
  warning: {
    border: "border-l-amber-400",
    bg: "bg-amber-400/5",
    text: "text-amber-400",
  },
}

interface CalloutProps {
  children: ReactNode
  type?: "info" | "warning"
}

export function Callout({ type = "info", children }: CalloutProps) {
  const styles = CALLOUT_STYLES[type] ?? CALLOUT_STYLES.info

  return (
    <div
      className={cn(
        "my-4 border border-border/50 border-l-2 px-4 py-3",
        styles.border,
        styles.bg
      )}
    >
      <div
        className={cn(
          "mb-1 font-medium text-xs uppercase tracking-wide",
          styles.text
        )}
      >
        {type === "warning" ? "Warning" : "Note"}
      </div>
      <div className="text-muted-foreground text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}
