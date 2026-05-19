import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TYPE_CONFIG: Record<
  string,
  { label: string; dotClass: string; textClass: string }
> = {
  feature: {
    label: "Feature",
    dotClass: "bg-foreground/40",
    textClass: "text-muted-foreground",
  },
  fix: {
    label: "Fix",
    dotClass: "bg-foreground/40",
    textClass: "text-muted-foreground",
  },
  improvement: {
    label: "Improvement",
    dotClass: "bg-foreground/40",
    textClass: "text-muted-foreground",
  },
  breaking: {
    label: "Breaking",
    dotClass: "bg-foreground/40",
    textClass: "text-muted-foreground",
  },
}

interface ChangeItemProps {
  children: ReactNode
  type: keyof typeof TYPE_CONFIG
}

export function ChangeItem({ type, children }: ChangeItemProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.improvement

  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="flex items-center gap-1.5 pt-[3px]">
        <span
          className={cn("block size-1 shrink-0 rounded-full", config.dotClass)}
        />
        <span
          className={cn(
            "shrink-0 font-mono text-[9px] uppercase tracking-wider",
            config.textClass
          )}
        >
          {config.label}
        </span>
      </div>
      <span className="text-muted-foreground text-sm leading-relaxed">
        {children}
      </span>
    </div>
  )
}
