"use client"

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

/**
 * Arrow-left / arrow-right navigation while a dialog is open. Shared by the file
 * dialog and the clip dialog so both navigate identically.
 */
export function useDialogArrowKeys(
  isOpen: boolean,
  prevId: number | null,
  nextId: number | null,
  onNavigate: (id: number) => void
) {
  const stableOnNavigate = useRef(onNavigate)
  stableOnNavigate.current = onNavigate
  const stablePrev = useRef(prevId)
  stablePrev.current = prevId
  const stableNext = useRef(nextId)
  stableNext.current = nextId

  useEffect(() => {
    if (!isOpen) {
      return
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (e.key === "ArrowLeft" && stablePrev.current != null) {
        e.preventDefault()
        stableOnNavigate.current(stablePrev.current)
      } else if (e.key === "ArrowRight" && stableNext.current != null) {
        e.preventDefault()
        stableOnNavigate.current(stableNext.current)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])
}

/** The prev/next bar with an `x/y` counter. Renders nothing for a single item. */
export function DialogNav({
  currentIndex,
  total,
  prevId,
  nextId,
  onNavigate,
  onNavigateCapture,
}: {
  currentIndex: number
  total: number
  prevId: number | null
  nextId: number | null
  onNavigate: (id: number) => void
  /** Side-effect hook (e.g. analytics) fired before navigating. */
  onNavigateCapture?: (direction: "prev" | "next", id: number) => void
}) {
  if (total <= 1) {
    return null
  }
  return (
    <div className="flex shrink-0 items-center justify-between border-border border-b px-3 py-1.5">
      <Button
        className="gap-1"
        disabled={prevId == null}
        onClick={(e) => {
          e.stopPropagation()
          if (prevId != null) {
            onNavigateCapture?.("prev", prevId)
            onNavigate(prevId)
          }
        }}
        size="sm"
        variant="ghost"
      >
        <CaretLeftIcon className="size-3.5" />
        <span className="hidden sm:inline">Prev</span>
      </Button>
      <span className="text-muted-foreground text-xs tabular-nums">
        {currentIndex + 1}/{total}
      </span>
      <Button
        className="gap-1"
        disabled={nextId == null}
        onClick={(e) => {
          e.stopPropagation()
          if (nextId != null) {
            onNavigateCapture?.("next", nextId)
            onNavigate(nextId)
          }
        }}
        size="sm"
        variant="ghost"
      >
        <span className="hidden sm:inline">Next</span>
        <CaretRightIcon className="size-3.5" />
      </Button>
    </div>
  )
}
