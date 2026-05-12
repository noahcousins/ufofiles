"use client"

import NumberFlow from "@number-flow/react"
import { XIcon } from "@phosphor-icons/react"
import { FunnelSimple, X } from "@phosphor-icons/react/dist/ssr"
import { AnimatePresence, animate, LayoutGroup, motion } from "motion/react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

const AGENCY_SEALS: Record<string, string> = {
  FBI: "/img/FBI-Seal.png",
  "Department of War": "/img/DOW-Seal.png",
  "Department of State": "/img/DOS-Seal.png",
  NASA: "/img/NASA-Insignia.png",
}

const TYPE_ORDER = ["video", "image", "pdf"] as const

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  video: "VID",
  image: "IMG",
}

const DATE_RANGE_LABELS: Record<string, string> = {
  "2010-now": "2010+",
  "2000s": "2000s",
  "1960-2000": "1960-2000",
  "pre-1960": "Pre-1960",
}

const DATE_RANGE_ORDER = ["2010-now", "2000s", "1960-2000", "pre-1960"]

export function AgencySeal({ agency }: { agency: string }) {
  const src = AGENCY_SEALS[agency]
  if (!src) {
    return null
  }
  return (
    <Image
      alt={`${agency} seal`}
      className="size-6 shrink-0 rounded-full object-contain"
      height={48}
      src={src}
      width={48}
    />
  )
}

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "most-views": "Most views",
  "least-views": "Least views",
}

export interface FileFiltersProps {
  agencies: string[]
  agency: string
  dateRange: string
  dateRangeCounts: { bucket: string; count: number }[]
  mobileSearchOpen?: boolean
  onAgencyChange: (value: string | null) => void
  onClearFilters: () => void
  onDateRangeChange: (value: string | null) => void
  onMobileSearchClose?: () => void
  onSearchChange: (value: string) => void
  onSortChange: (value: string) => void
  onTypeChange: (value: string | null) => void
  searchInput: string
  sort: string
  type: string
  typeCounts: { type: string; count: number }[]
  typeCountsLoading?: boolean
}

export function FileFilters({
  searchInput,
  onSearchChange,
  agency,
  onAgencyChange,
  type,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  onMobileSearchClose,
  onSortChange,
  agencies,
  sort,
  typeCounts,
  typeCountsLoading,
  dateRangeCounts,
  mobileSearchOpen,
}: FileFiltersProps) {
  const hasActiveFilters = !!(
    searchInput ||
    agency ||
    type ||
    dateRange ||
    (sort && sort !== "newest")
  )

  const activeFilterCount = (agency ? 1 : 0) + (dateRange ? 1 : 0)

  // Auto-scroll the type filter row to hint at overflow
  const typeScrollRef = useRef<HTMLDivElement>(null)
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const stopAnimation = useRef<(() => void) | null>(null)
  const isAutoScrolling = useRef(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateOverflowIndicators = useCallback(() => {
    const el = typeScrollRef.current
    if (!el) {
      return
    }
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  // Check overflow on mount and when typeCounts change
  useEffect(() => {
    updateOverflowIndicators()
    const el = typeScrollRef.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(updateOverflowIndicators)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateOverflowIndicators, typeCounts])

  const startAutoScroll = useCallback(() => {
    const el = typeScrollRef.current
    if (!el) {
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) {
      return // nothing to scroll
    }

    isAutoScrolling.current = true

    // Scroll right slowly, then back
    const scrollRight = animate(el.scrollLeft, maxScroll, {
      duration: 4,
      ease: "easeInOut",
      onUpdate: (v) => {
        el.scrollLeft = v
        updateOverflowIndicators()
      },
      onComplete: () => {
        // Pause, then scroll back
        const backTimer = setTimeout(() => {
          const scrollBack = animate(maxScroll, 0, {
            duration: 4,
            ease: "easeInOut",
            onUpdate: (v) => {
              el.scrollLeft = v
              updateOverflowIndicators()
            },
            onComplete: () => {
              isAutoScrolling.current = false
            },
          })
          stopAnimation.current = () => {
            scrollBack.stop()
            isAutoScrolling.current = false
          }
        }, 800)
        stopAnimation.current = () => {
          clearTimeout(backTimer)
          isAutoScrolling.current = false
        }
      },
    })
    stopAnimation.current = () => {
      scrollRight.stop()
      isAutoScrolling.current = false
    }
  }, [])

  const resetAutoScroll = useCallback(
    (delay: number) => {
      if (autoScrollTimer.current) {
        clearTimeout(autoScrollTimer.current)
      }
      if (stopAnimation.current) {
        stopAnimation.current()
        stopAnimation.current = null
      }
      autoScrollTimer.current = setTimeout(startAutoScroll, delay)
    },
    [startAutoScroll]
  )

  // Initial 3-second delay on mount (skip if user has interacted before)
  useEffect(() => {
    const hasInteracted =
      typeof window !== "undefined" &&
      localStorage.getItem("filter-scroll-seen") === "true"
    if (hasInteracted) {
      return
    }
    autoScrollTimer.current = setTimeout(startAutoScroll, 3000)
    return () => {
      if (autoScrollTimer.current) {
        clearTimeout(autoScrollTimer.current)
      }
      if (stopAnimation.current) {
        stopAnimation.current()
      }
    }
  }, [startAutoScroll])

  // On user interaction, stop any animation and never auto-scroll again
  const handleTypeScrollInteraction = useCallback(() => {
    if (autoScrollTimer.current) {
      clearTimeout(autoScrollTimer.current)
    }
    if (stopAnimation.current) {
      stopAnimation.current()
      stopAnimation.current = null
    }
    try {
      localStorage.setItem("filter-scroll-seen", "true")
    } catch {}
  }, [])

  const handleTypeScroll = useCallback(() => {
    updateOverflowIndicators()
  }, [updateOverflowIndicators])

  return (
    <div className="">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        {/* Desktop filters - hidden on mobile */}
        <div className="hidden w-full grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
          <div className="relative col-span-2">
            <Input
              className="h-9 pr-8 text-sm"
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files..."
              type="text"
              value={searchInput}
            />
            {searchInput && (
              <button
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onSearchChange("")}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Select
            modal={false}
            onValueChange={(val) => onAgencyChange(val === "all" ? null : val)}
            value={agency || "all"}
          >
            <SelectTrigger className="w-full text-sm data-[size=default]:h-9">
              <SelectValue>
                {agency ? (
                  <>
                    <AgencySeal agency={agency} />
                    {agency}
                  </>
                ) : (
                  "All agencies"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">
                <span aria-hidden className="size-6 shrink-0" />
                All agencies
              </SelectItem>
              {agencies.map((a) => (
                <SelectItem key={a} value={a}>
                  <AgencySeal agency={a} />
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            modal={false}
            onValueChange={(val) =>
              onDateRangeChange(val === "all" ? null : val)
            }
            value={dateRange || "all"}
          >
            <SelectTrigger className="w-full text-sm data-[size=default]:h-9">
              <SelectValue>
                {dateRange
                  ? (DATE_RANGE_LABELS[dateRange] ?? dateRange)
                  : "All dates"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">All dates</SelectItem>
              {DATE_RANGE_ORDER.map((bucket) => {
                const dc = dateRangeCounts.find((d) => d.bucket === bucket)
                return (
                  <SelectItem key={bucket} value={bucket}>
                    {DATE_RANGE_LABELS[bucket]}
                    {dc ? ` (${dc.count})` : ""}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full justify-between gap-1 font-mono tracking-tighter">
          <div
            className="flex min-w-0 items-center gap-1 overflow-x-auto font-mono tracking-tighter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onClick={handleTypeScrollInteraction}
            onPointerDown={handleTypeScrollInteraction}
            onScroll={handleTypeScroll}
            ref={typeScrollRef}
            style={{
              maskImage:
                canScrollLeft && canScrollRight
                  ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)"
                  : canScrollLeft
                    ? "linear-gradient(to right, transparent, black 24px)"
                    : canScrollRight
                      ? "linear-gradient(to right, black calc(100% - 24px), transparent)"
                      : undefined,
            }}
          >
            {(() => {
              const normalized = TYPE_ORDER.map((t) => ({
                type: t,
                count: typeCounts.find((tc) => tc.type === t)?.count ?? 0,
              }))
              const sorted = [...normalized].sort((a, b) => {
                if (a.count === 0 && b.count !== 0) {
                  return 1
                }
                if (a.count !== 0 && b.count === 0) {
                  return -1
                }
                return 0
              })
              const allCount = typeCounts.reduce((sum, tc) => sum + tc.count, 0)

              return (
                <LayoutGroup>
                  <motion.div layout layoutId="filter-all">
                    <Button
                      className={
                        type ? "" : "border-ring bg-ring/10 text-foreground"
                      }
                      onClick={() => onTypeChange(null)}
                      size="sm"
                      variant={type ? "ghost" : "outline"}
                    >
                      All (
                      <NumberFlow
                        className={typeCountsLoading ? "animate-pulse" : ""}
                        value={allCount}
                      />
                      )
                    </Button>
                  </motion.div>
                  {sorted.map((tc) => (
                    <motion.div
                      key={tc.type}
                      layout
                      layoutId={`filter-${tc.type}`}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    >
                      <Button
                        className={
                          type === tc.type
                            ? "border-ring bg-ring/10 text-foreground"
                            : ""
                        }
                        disabled={tc.count === 0}
                        onClick={() =>
                          onTypeChange(type === tc.type ? null : tc.type)
                        }
                        size="sm"
                        variant={type === tc.type ? "outline" : "ghost"}
                      >
                        {TYPE_LABELS[tc.type] ?? tc.type} (
                        <NumberFlow
                          className={typeCountsLoading ? "animate-pulse" : ""}
                          value={tc.count}
                        />
                        )
                      </Button>
                    </motion.div>
                  ))}
                </LayoutGroup>
              )
            })()}
          </div>
          <div className="ml-auto flex shrink-0 items-center">
            <Drawer modal={false}>
              <DrawerTrigger className="inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted hover:text-foreground lg:hidden">
                <FunnelSimple className="size-4" />
                {activeFilterCount > 0 && (
                  <span className="inline-flex size-4 items-center justify-center rounded-none bg-foreground text-[10px] text-background">
                    {activeFilterCount}
                  </span>
                )}
              </DrawerTrigger>
              <DrawerContent className="inset-x-0 bottom-0 mt-24 max-h-[80vh] border-t">
                <DrawerHeader className="pt-0 pb-4">
                  <DrawerTitle className="font-medium font-mono text-lg tracking-tighter">
                    Filters
                  </DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-medium text-muted-foreground text-xs"
                      htmlFor="agency"
                    >
                      Agency
                    </label>
                    <Select
                      modal={false}
                      onValueChange={(val) => {
                        onAgencyChange(val === "all" ? null : val)
                      }}
                      value={agency || "all"}
                    >
                      <SelectTrigger className="w-full text-[16px] data-[size=default]:h-12">
                        <SelectValue>
                          {agency ? (
                            <>
                              <AgencySeal agency={agency} />
                              {agency}
                            </>
                          ) : (
                            "All agencies"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="all">
                          <span aria-hidden className="size-6 shrink-0" />
                          All agencies
                        </SelectItem>
                        {agencies.map((a) => (
                          <SelectItem key={a} value={a}>
                            <AgencySeal agency={a} />
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-medium text-muted-foreground text-xs"
                      htmlFor="date-range"
                    >
                      Date range
                    </label>
                    <Select
                      modal={false}
                      onValueChange={(val) => {
                        onDateRangeChange(val === "all" ? null : val)
                      }}
                      value={dateRange || "all"}
                    >
                      <SelectTrigger className="w-full text-[16px] data-[size=default]:h-12">
                        <SelectValue>
                          {dateRange
                            ? (DATE_RANGE_LABELS[dateRange] ?? dateRange)
                            : "All dates"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="all">All dates</SelectItem>
                        {DATE_RANGE_ORDER.map((bucket) => {
                          const dc = dateRangeCounts.find(
                            (d) => d.bucket === bucket
                          )
                          return (
                            <SelectItem key={bucket} value={bucket}>
                              {DATE_RANGE_LABELS[bucket]}
                              {dc ? ` (${dc.count})` : ""}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <DrawerClose
                    render={<Button className="mt-2 w-full" size="lg" />}
                  >
                    Done
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
            <Select
              modal={false}
              onValueChange={(val) => val && onSortChange(val)}
              value={sort || "newest"}
            >
              <SelectTrigger className="h-7 w-fit border-none font-mono text-xs">
                <SelectValue>{SORT_LABELS[sort] ?? "Newest"}</SelectValue>
              </SelectTrigger>
              <SelectContent
                align="end"
                alignItemWithTrigger={false}
                className="font-mono text-xs"
              >
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="most-views">Most views</SelectItem>
                <SelectItem value="least-views">Least views</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex w-full items-center">
            <div className="flex items-center gap-2">
              {/* <Separator className="my-auto h-3.5" orientation="vertical" /> */}
              <button
                className="flex items-center gap-1 text-muted-foregroun text-xs hover:text-foreground"
                onClick={onClearFilters}
                type="button"
              >
                <XIcon className="size-3.5" />
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile search bar - slides open from bottom of filters */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden lg:hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <div className="mx-auto max-w-6xl px-4 pt-1 pb-3">
              <div className="relative">
                <Input
                  autoFocus
                  className="h-12 w-full pr-10 text-[16px]"
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search files..."
                  type="text"
                  value={searchInput}
                />
                <button
                  aria-label={searchInput ? "Clear search" : "Close search"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    if (searchInput) {
                      onSearchChange("")
                    } else {
                      onMobileSearchClose?.()
                    }
                  }}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FileFiltersSkeleton() {
  return (
    <div className="">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        {/* Desktop filters - hidden on mobile, matching real 4-col grid */}
        <div className="hidden w-full grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
          <Skeleton className="col-span-2 h-9 border border-border" />
          <Skeleton className="h-9 border border-border" />
          <Skeleton className="h-9 border border-border" />
        </div>

        {/* Type filter row + sort - matches real layout */}
        <div className="flex w-full justify-between gap-1 font-mono tracking-tighter">
          <div className="mt-[1px] flex items-center gap-1">
            <Skeleton className="h-7 w-[88px] border border-border" />
            <Skeleton className="h-7 w-[81px]" />
            <Skeleton className="h-7 w-[81px]" />
            <Skeleton className="h-7 w-[81px]" />
          </div>
          <div className="ml-auto flex shrink-0 items-center">
            <Skeleton className="h-7 w-11 lg:hidden" />
            <Skeleton className="h-7 w-[72px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
