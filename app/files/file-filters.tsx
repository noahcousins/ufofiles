"use client"

import { FunnelSimple } from "@phosphor-icons/react/dist/ssr"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
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
import { Separator } from "@/components/ui/separator"

const AGENCY_SEALS: Record<string, string> = {
  FBI: "/img/FBI-Seal.png",
  "Department of War": "/img/DOW-Seal.png",
  "Department of State": "/img/DOS-Seal.png",
  NASA: "/img/NASA-Insignia.png",
}

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  video: "VID",
  image: "IMG",
  other: "Other",
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
  onSearchChange: (value: string) => void
  onSortChange: (value: string) => void
  onTypeChange: (value: string | null) => void
  searchInput: string
  sort: string
  totalDocuments: number | null
  type: string
  typeCounts: { type: string; count: number }[]
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
  onSortChange,
  agencies,
  sort,
  typeCounts,
  dateRangeCounts,
  totalDocuments,
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

  return (
    <div className="">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        {/* Desktop filters - hidden on mobile */}
        <div className="hidden w-full grid-cols-2 gap-3 md:grid lg:grid-cols-4">
          <Input
            className="col-span-2 h-9 text-sm"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            type="text"
            value={searchInput}
          />

          <Select
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
          <div className="flex gap-1 font-mono tracking-tighter">
            {typeCounts.map((tc) => (
              <Button
                className={
                  type === tc.type
                    ? "border-ring bg-ring/10 text-foreground"
                    : ""
                }
                key={tc.type}
                onClick={() => onTypeChange(type === tc.type ? null : tc.type)}
                size="sm"
                variant={type === tc.type ? "outline" : "ghost"}
              >
                {TYPE_LABELS[tc.type] ?? tc.type} ({tc.count})
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center">
            <Drawer direction="bottom" modal={false}>
              <DrawerTrigger className="inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-none border border-transparent px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted hover:text-foreground md:hidden">
                <FunnelSimple className="size-4" />
                {activeFilterCount > 0 && (
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
                    {activeFilterCount}
                  </span>
                )}
              </DrawerTrigger>
              <DrawerContent className="inset-x-0 bottom-0 mt-24 max-h-[80vh] border-t">
                <DrawerHeader>
                  <DrawerTitle>Filters</DrawerTitle>
                </DrawerHeader>
                <div className="flex flex-col gap-4 px-4 pb-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-medium text-muted-foreground text-xs">
                      Agency
                    </label>
                    <Select
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
                    <label className="font-medium text-muted-foreground text-xs">
                      Date range
                    </label>
                    <Select
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

                  <DrawerClose asChild>
                    <Button className="mt-2 w-full" size="lg">
                      Done
                    </Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
            <Select
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

        <div className="flex w-full items-center">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums tracking-tight">
              {totalDocuments === null ? " " : `${totalDocuments} files`}
            </span>

            {hasActiveFilters && (
              <>
                <Separator className="my-auto h-3.5" orientation="vertical" />
                <button
                  className="text-muted-foreground text-xs hover:text-foreground"
                  onClick={onClearFilters}
                  type="button"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar - slides open from bottom of filters */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden md:hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <div className="mx-auto max-w-6xl px-4 pb-3">
              <Input
                autoFocus
                className="h-12 w-full text-[16px]"
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search files..."
                type="text"
                value={searchInput}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FileFiltersSkeleton() {
  return (
    <div className="border-border/40 border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-1 h-8 animate-pulse rounded-none border border-border bg-muted/30 sm:col-span-1 md:col-span-2 lg:col-span-3" />
          <div className="h-8 animate-pulse rounded-none border border-border bg-muted/30" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              className="h-7 w-16 animate-pulse rounded-none bg-muted/30"
              // biome-ignore lint/suspicious/noArrayIndexKey: ignore
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
