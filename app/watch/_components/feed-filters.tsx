"use client"

import NumberFlow from "@number-flow/react"
import { XIcon } from "@phosphor-icons/react"
import { FunnelSimple } from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"
import {
  AccordionSection,
  AgencySelect,
  DATE_RANGE_LABELS,
  DATE_RANGE_ORDER,
  type ReleaseInfo,
  ReleaseSelect,
  TAG_CATEGORY_LABELS,
  TAG_CATEGORY_ORDER,
  type TagInfo,
} from "@/components/files/filter-controls"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface FeedFiltersProps {
  // videoFeedFacets result; undefined while the query is in flight.
  facets?: {
    agencies: string[]
    dateRangeCounts: { bucket: string; count: number }[]
    releaseCounts: Record<number, number>
    tags: TagInfo[]
  }
  filters: { agency: string; dateRange: string; release: string; tag: string }
  handlers: {
    onAgencyChange: (value: string | null) => void
    onClearFilters: () => void
    onDateRangeChange: (value: string | null) => void
    onReleaseChange: (value: string | null) => void
    onTagChange: (value: string | null) => void
  }
  releases: ReleaseInfo[]
  totalVideos: number | null
}

/**
 * The watch page's filter control: the file browser's mobile filter drawer,
 * shown at every viewport size (the full-screen feed has no room for an
 * inline filter grid). Triggered from the feed header.
 */
export function FeedFilters({
  facets,
  filters,
  handlers,
  releases,
  totalVideos,
}: FeedFiltersProps) {
  const { agency, dateRange, release, tag } = filters
  const {
    onAgencyChange,
    onClearFilters,
    onDateRangeChange,
    onReleaseChange,
    onTagChange,
  } = handlers
  const agencies = facets?.agencies ?? []
  const dateRangeCounts = facets?.dateRangeCounts ?? []
  const releaseCounts = facets?.releaseCounts
  const tagList = facets?.tags ?? []

  const activeTags = tag ? tag.split(",") : []
  const defaultSection =
    activeTags.length > 0
      ? (TAG_CATEGORY_ORDER.find((cat) =>
          tagList.some((t) => t.category === cat && activeTags.includes(t.slug))
        ) ?? "phenomenon")
      : "phenomenon"
  const [openSection, setOpenSection] = useState<string | null>(defaultSection)

  const activeFilterCount =
    (agency ? 1 : 0) + (dateRange ? 1 : 0) + (release ? 1 : 0) + (tag ? 1 : 0)

  // Only releases with feed-eligible videos under the current cross-filters —
  // hides untranscoded release-1 and any dead-end combination outright.
  const eligibleReleases = releaseCounts
    ? releases.filter((r) => (releaseCounts[r.id] ?? 0) > 0)
    : releases

  return (
    <Drawer modal={false}>
      <DrawerTrigger className="pointer-events-auto inline-flex h-9 select-none items-center gap-1.5 px-2 font-medium text-white/70 text-xs transition-colors hover:text-white">
        <FunnelSimple className="size-5" />
        {activeFilterCount > 0 && (
          <span className="inline-flex size-4 items-center justify-center rounded-none bg-white font-mono text-[10px] text-black">
            {activeFilterCount}
          </span>
        )}
      </DrawerTrigger>
      <DrawerContent className="inset-x-0 bottom-0 mt-24 max-h-[80vh] border-t lg:mx-auto lg:max-w-md lg:border-x">
        <DrawerHeader className="pt-0 pb-4">
          <DrawerTitle className="font-medium font-mono text-lg tracking-tighter">
            Filters
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              Agency
            </span>
            <AgencySelect
              agencies={agencies}
              agency={agency}
              mobile
              onAgencyChange={onAgencyChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              Release
            </span>
            <ReleaseSelect
              mobile
              onReleaseChange={onReleaseChange}
              release={release}
              releaseCounts={releaseCounts}
              releases={eligibleReleases}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              Date Range
            </span>
            <Select
              modal={false}
              onValueChange={(val) => {
                onDateRangeChange(val === "all" ? null : val)
              }}
              value={dateRange || "all"}
            >
              <SelectTrigger className="w-full text-[16px] data-[size=default]:h-12">
                <SelectValue>
                  {dateRange ? DATE_RANGE_LABELS[dateRange] : "All dates"}
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

          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              Tags
            </span>
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

          {activeFilterCount > 0 && (
            <button
              className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              onClick={onClearFilters}
              type="button"
            >
              <XIcon className="size-3.5" />
              Clear filters
            </button>
          )}

          <DrawerClose render={<Button className="mt-2 w-full" size="lg" />}>
            {totalVideos === 0 ? (
              "No videos found"
            ) : (
              <span className="flex items-center gap-1">
                View
                <NumberFlow value={totalVideos ?? 0} />
                video{totalVideos === 1 ? "" : "s"}
              </span>
            )}
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
