"use client"

import NumberFlow from "@number-flow/react"
import { XIcon } from "@phosphor-icons/react"
import {
  CalendarBlank,
  CalendarDots,
  CaretDown,
  FunnelSimple,
  Tag as TagIcon,
  X,
} from "@phosphor-icons/react/dist/ssr"
import { AnimatePresence, animate, LayoutGroup, motion } from "motion/react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
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
  "Department of Energy": "/img/DOE-Seal.png",
  "Central Intelligence Agency": "/img/CIA-Seal.png",
  "Office of the Director of National Intelligence": "/img/ODNI-Seal.png",
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
  const src = AGENCY_SEALS[agency] ?? "/img/US-Flag.png"
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

interface ReleaseInfo {
  fileCount: number
  id: number
  name: string
  releaseDate: string | null
  title: string
}

interface TagInfo {
  category: string
  count: number
  label: string
  slug: string
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
  onMarkReleaseSeen: () => void
  onMobileSearchClose?: () => void
  onReleaseChange: (value: string | null) => void
  onSearchChange: (value: string) => void
  onSortChange: (value: string) => void
  onTagChange: (value: string | null) => void
  onTypeChange: (value: string | null) => void
  release: string
  releaseCounts?: Record<number, number>
  releases: ReleaseInfo[]
  searchInput: string
  seenNewestRelease: boolean
  sort: string
  tag: string
  tags: TagInfo[]
  totalFiles: number | null
  type: string
  typeCounts: { type: string; count: number }[]
  typeCountsLoading?: boolean
}

const TAG_CATEGORY_ORDER = [
  "phenomenon",
  "document-type",
  "content",
  "resolution",
] as const

const TAG_CATEGORY_LABELS: Record<string, string> = {
  phenomenon: "Phenomenon",
  "document-type": "Document Type",
  content: "Content",
  resolution: "Resolution",
}

function AccordionSection({
  title,
  children,
  open,
  onToggle,
}: {
  title: string
  children: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-1.5 font-medium font-sans text-muted-foreground text-xs tracking-normal hover:text-foreground"
        onClick={onToggle}
        type="button"
      >
        {title}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <CaretDown className="size-3" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <div className="mt-2 flex flex-wrap gap-1.5 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TagButton({
  tag,
  tagList,
  onTagChange,
}: {
  tag: string
  tagList: TagInfo[]
  onTagChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeTags = tag ? tag.split(",") : []
  const defaultSection =
    activeTags.length > 0
      ? (TAG_CATEGORY_ORDER.find((cat) =>
          tagList.some((t) => t.category === cat && activeTags.includes(t.slug))
        ) ?? "phenomenon")
      : "phenomenon"
  const [openSection, setOpenSection] = useState<string | null>(defaultSection)

  useEffect(() => {
    if (!open) {
      return
    }
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        className={`inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent px-3 font-medium text-xs transition-all hover:bg-muted hover:text-foreground ${
          activeTags.length > 0 ? "text-foreground" : "text-muted-foreground"
        }`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <TagIcon className="size-4" />
        {activeTags.length > 0 && (
          <span className="inline-flex size-4 items-center justify-center rounded-none bg-foreground text-[10px] text-background">
            {activeTags.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full right-0 z-50 mt-1 max-h-80 min-w-[260px] overflow-y-auto overscroll-contain bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {activeTags.length > 0 && (
              <button
                className="mb-2 flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => {
                  onTagChange(null)
                }}
                type="button"
              >
                <XIcon className="size-3" />
                Clear tags
              </button>
            )}
            {TAG_CATEGORY_ORDER.map((cat) => {
              const catTags = tagList.filter((t) => t.category === cat)
              if (catTags.length === 0) {
                return null
              }
              return (
                <AccordionSection
                  key={cat}
                  onToggle={() =>
                    setOpenSection((prev) => (prev === cat ? null : cat))
                  }
                  open={openSection === cat}
                  title={TAG_CATEGORY_LABELS[cat] ?? cat}
                >
                  {catTags.map((t) => {
                    const isActive = activeTags.includes(t.slug)
                    return (
                      <button
                        key={t.slug}
                        onClick={() => onTagChange(t.slug)}
                        type="button"
                      >
                        <Badge
                          className={`cursor-pointer px-1.5 py-3 transition-colors ${
                            isActive
                              ? "border-ring bg-ring/10 text-foreground"
                              : "hover:bg-muted"
                          }`}
                          variant={isActive ? "outline" : "secondary"}
                        >
                          {t.label}
                          <span className="text-muted-foreground">
                            {t.count}
                          </span>
                        </Badge>
                      </button>
                    )
                  })}
                </AccordionSection>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AgencySelect({
  agency,
  agencies,
  onAgencyChange,
  mobile,
}: {
  agency: string
  agencies: string[]
  onAgencyChange: (value: string | null) => void
  mobile?: boolean
}) {
  return (
    <Select
      modal={false}
      onValueChange={(val) => onAgencyChange(val === "all" ? null : val)}
      value={agency || "all"}
    >
      <SelectTrigger
        className={
          mobile
            ? "w-full text-[16px] data-[size=default]:h-12"
            : "w-full text-sm data-[size=default]:h-9"
        }
      >
        <SelectValue>
          {agency ? (
            <>
              <AgencySeal agency={agency} />
              {agency}
            </>
          ) : (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center">
                <Image
                  alt="US Flag"
                  className="size-4 object-contain"
                  height={48}
                  src="/img/US-Flag.png"
                  width={48}
                />
              </span>
              All agencies
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="all">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Image
              alt="US Flag"
              className="size-4 object-contain"
              height={48}
              src="/img/US-Flag.png"
              width={48}
            />
          </span>
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
  )
}

function ReleaseSelect({
  release,
  releases,
  releaseCounts,
  onReleaseChange,
  isReleaseNew,
  hasNewRelease,
  seenNewestRelease,
  markReleaseSeen,
  mobile,
}: {
  release: string
  releases: ReleaseInfo[]
  releaseCounts?: Record<number, number>
  onReleaseChange: (value: string | null) => void
  isReleaseNew: (r: ReleaseInfo) => boolean
  hasNewRelease: boolean
  seenNewestRelease: boolean
  markReleaseSeen: () => void
  mobile?: boolean
}) {
  return (
    <Select
      modal={false}
      onValueChange={(val) => {
        onReleaseChange(val === "all" ? null : val)
        const selected = releases.find((r) => r.name === val)
        if (selected && isReleaseNew(selected)) {
          markReleaseSeen()
        }
      }}
      value={release || "all"}
    >
      <SelectTrigger
        className={
          mobile
            ? "w-full text-[16px] data-[size=default]:h-12"
            : "w-full text-sm data-[size=default]:h-9"
        }
      >
        {hasNewRelease && !seenNewestRelease && (
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ring opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-ring" />
          </span>
        )}
        <SelectValue>
          {release
            ? (releases.find((r) => r.name === release)?.title ?? release)
            : "All releases"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="all">All releases</SelectItem>
        {releases.map((r) => (
          <SelectItem key={r.name} value={r.name}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {isReleaseNew(r) && !seenNewestRelease && (
                  <span className="relative flex size-1.5 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ring opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-ring" />
                  </span>
                )}
                {r.title}
              </span>
              <span className="flex items-center gap-1.5">
                {isReleaseNew(r) && (
                  <Badge
                    className="bg-primary! px-1 py-0 text-[10px] text-primary-foreground! uppercase"
                    variant="default"
                  >
                    New
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {releaseCounts ? (releaseCounts[r.id] ?? 0) : r.fileCount}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DateRangeButton({
  dateRange,
  dateRangeCounts,
  onDateRangeChange,
}: {
  dateRange: string
  dateRangeCounts: { bucket: string; count: number }[]
  onDateRangeChange: (value: string | null) => void
}) {
  return (
    <Select
      modal={false}
      onValueChange={(val) => onDateRangeChange(val === "all" ? null : val)}
      value={dateRange || "all"}
    >
      <SelectTrigger
        className={`inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent bg-transparent px-3 py-1.5 font-medium text-xs shadow-none transition-all hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted [&>svg:last-child]:hidden ${
          dateRange ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {dateRange ? (
          <CalendarDots className="size-4" />
        ) : (
          <CalendarBlank className="size-4" />
        )}
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="font-mono text-xs"
      >
        <SelectItem value="all">All dates</SelectItem>
        {DATE_RANGE_ORDER.map((bucket) => {
          const dc = dateRangeCounts.find((d) => d.bucket === bucket)
          return (
            <SelectItem key={bucket} value={bucket}>
              <span className="flex w-full items-center justify-between gap-4">
                {DATE_RANGE_LABELS[bucket]}
                {dc ? (
                  <span className="text-muted-foreground">{dc.count}</span>
                ) : null}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
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
  release,
  releaseCounts,
  onReleaseChange,
  releases,
  onClearFilters,
  onMarkReleaseSeen,
  onMobileSearchClose,
  onSortChange,
  onTagChange,
  agencies,
  seenNewestRelease,
  sort,
  tag,
  tags: tagList,
  totalFiles,
  typeCounts,
  typeCountsLoading,
  dateRangeCounts,
  mobileSearchOpen,
}: FileFiltersProps) {
  const mobileActiveTags = tag ? tag.split(",") : []
  const mobileDefaultSection =
    mobileActiveTags.length > 0
      ? (TAG_CATEGORY_ORDER.find((cat) =>
          tagList.some(
            (t) => t.category === cat && mobileActiveTags.includes(t.slug)
          )
        ) ?? "phenomenon")
      : "phenomenon"
  const [mobileOpenSection, setMobileOpenSection] = useState<string | null>(
    mobileDefaultSection
  )

  const isReleaseNew = (r: ReleaseInfo) => {
    if (!r.releaseDate) {
      return false
    }
    const diff = Date.now() - new Date(r.releaseDate).getTime()
    return diff < 7 * 24 * 60 * 60 * 1000
  }

  const hasNewRelease = releases.some(isReleaseNew)

  const hasActiveFilters = !!(
    searchInput ||
    agency ||
    type ||
    dateRange ||
    release ||
    tag ||
    (sort && sort !== "most-views")
  )

  const activeFilterCount =
    (agency ? 1 : 0) + (dateRange ? 1 : 0) + (release ? 1 : 0) + (tag ? 1 : 0)

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

          <AgencySelect
            agencies={agencies}
            agency={agency}
            onAgencyChange={onAgencyChange}
          />
          <ReleaseSelect
            hasNewRelease={hasNewRelease}
            isReleaseNew={isReleaseNew}
            markReleaseSeen={onMarkReleaseSeen}
            onReleaseChange={onReleaseChange}
            release={release}
            releaseCounts={releaseCounts}
            releases={releases}
            seenNewestRelease={seenNewestRelease}
          />
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
              <DrawerTrigger className="inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent px-3 font-medium text-muted-foreground text-xs transition-all hover:bg-muted hover:text-foreground lg:hidden">
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
                    <label className="font-medium text-muted-foreground text-xs">
                      Agency
                    </label>
                    <AgencySelect
                      agencies={agencies}
                      agency={agency}
                      mobile
                      onAgencyChange={onAgencyChange}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-muted-foreground text-xs">
                      Release
                    </label>
                    <ReleaseSelect
                      hasNewRelease={hasNewRelease}
                      isReleaseNew={isReleaseNew}
                      markReleaseSeen={onMarkReleaseSeen}
                      mobile
                      onReleaseChange={onReleaseChange}
                      release={release}
                      releaseCounts={releaseCounts}
                      releases={releases}
                      seenNewestRelease={seenNewestRelease}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-muted-foreground text-xs">
                      Date Range
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
                            ? DATE_RANGE_LABELS[dateRange]
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

                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-muted-foreground text-xs">
                      Tags
                    </label>
                    {tag && (
                      <button
                        className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                        onClick={() => onTagChange(null)}
                        type="button"
                      >
                        <XIcon className="size-3" />
                        Clear tags
                      </button>
                    )}
                    {TAG_CATEGORY_ORDER.map((cat) => {
                      const catTags = tagList.filter((t) => t.category === cat)
                      if (catTags.length === 0) {
                        return null
                      }
                      return (
                        <AccordionSection
                          key={cat}
                          onToggle={() =>
                            setMobileOpenSection((prev) =>
                              prev === cat ? null : cat
                            )
                          }
                          open={mobileOpenSection === cat}
                          title={TAG_CATEGORY_LABELS[cat] ?? cat}
                        >
                          {catTags.map((t) => {
                            const isActive = mobileActiveTags.includes(t.slug)
                            return (
                              <button
                                key={t.slug}
                                onClick={() => onTagChange(t.slug)}
                                type="button"
                              >
                                <Badge
                                  className={`cursor-pointer py-3 transition-colors ${
                                    isActive
                                      ? "border-ring bg-ring/10 text-foreground"
                                      : "hover:bg-muted"
                                  }`}
                                  variant={isActive ? "outline" : "secondary"}
                                >
                                  {t.label}
                                  <span className="text-muted-foreground">
                                    {t.count}
                                  </span>
                                </Badge>
                              </button>
                            )
                          })}
                        </AccordionSection>
                      )
                    })}
                  </div>

                  <DrawerClose
                    render={<Button className="mt-2 w-full" size="lg" />}
                  >
                    {totalFiles === 0 ? (
                      "No files found"
                    ) : (
                      <span className="flex items-center gap-1">
                        View
                        <NumberFlow value={totalFiles ?? 0} />
                        file{totalFiles === 1 ? "" : "s"}
                      </span>
                    )}
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
            <div className="hidden lg:flex">
              <TagButton
                onTagChange={onTagChange}
                tag={tag}
                tagList={tagList}
              />
              <DateRangeButton
                dateRange={dateRange}
                dateRangeCounts={dateRangeCounts}
                onDateRangeChange={onDateRangeChange}
              />
            </div>
            <Select
              modal={false}
              onValueChange={(val) => val && onSortChange(val)}
              value={sort || "most-views"}
            >
              <SelectTrigger className="h-7 w-fit border-none font-mono text-xs">
                <SelectValue>{SORT_LABELS[sort] ?? "Most views"}</SelectValue>
              </SelectTrigger>
              <SelectContent
                align="end"
                alignItemWithTrigger={false}
                className="font-mono text-xs"
              >
                <SelectItem value="most-views">Most views</SelectItem>
                <SelectItem value="least-views">Least views</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
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

        {/* Type filter row + right-side controls */}
        <div className="flex w-full justify-between gap-1 font-mono tracking-tighter">
          <div className="mt-[1px] flex items-center gap-1">
            <Skeleton className="h-7 w-[88px] border border-border" />
            <Skeleton className="h-7 w-[81px]" />
            <Skeleton className="h-7 w-[81px]" />
            <Skeleton className="h-7 w-[81px]" />
          </div>
          <div className="ml-auto flex shrink-0 items-center">
            {/* Mobile: funnel filter button */}
            <Skeleton className="h-7 w-10 lg:hidden" />
            {/* Desktop: tag + date icon buttons */}
            <div className="hidden lg:flex">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-7 w-10" />
            </div>
            {/* Sort */}
            <Skeleton className="h-7 w-[88px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
