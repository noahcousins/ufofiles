"use client"

import NumberFlow from "@number-flow/react"
import { LayoutGroup, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface FilterPillOption {
  /** Optional trailing count, animated with NumberFlow. */
  count?: number
  disabled?: boolean
  label: string
  value: string
}

/**
 * A single-select row of count "pills" — the shared bones of the file browser's
 * type filter (All / Video / Image / …). Selected pill gets the ring treatment;
 * the row reflows with a layout spring. The caller owns the container (and any
 * scroll/overflow behavior); this just renders the pills.
 */
export function FilterPills({
  options,
  value,
  onChange,
  loading = false,
  idPrefix = "filterpill",
}: {
  options: FilterPillOption[]
  value: string
  onChange: (value: string) => void
  loading?: boolean
  /** Disambiguates layoutId when more than one row is on the same page. */
  idPrefix?: string
}) {
  return (
    <LayoutGroup>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <motion.div
            key={opt.value}
            layout
            layoutId={`${idPrefix}-${opt.value}`}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <Button
              className={cn(
                selected && "border-ring bg-ring/10 text-foreground"
              )}
              disabled={opt.disabled}
              onClick={() => onChange(opt.value)}
              size="sm"
              variant={selected ? "outline" : "ghost"}
            >
              {opt.label}
              {opt.count != null && (
                <>
                  {" ("}
                  <NumberFlow
                    className={loading ? "animate-pulse" : ""}
                    value={opt.count}
                  />
                  {")"}
                </>
              )}
            </Button>
          </motion.div>
        )
      })}
    </LayoutGroup>
  )
}
