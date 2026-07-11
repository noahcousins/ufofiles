"use client"

import { parseAsString, useQueryStates } from "nuqs"
import posthog from "posthog-js"
import { useCallback } from "react"
import {
  DATE_RANGE_ORDER,
  type DateRange,
  toggleTagParam,
} from "@/components/files/filter-controls"
import { trpc } from "@/lib/trpc/client"

// Same param names as the file browser's filters, so filtered feeds are
// shareable URLs with a familiar shape (`release` is the release *name*).
const filterParsers = {
  agency: parseAsString.withDefault(""),
  dateRange: parseAsString.withDefault(""),
  release: parseAsString.withDefault(""),
  tag: parseAsString.withDefault(""),
}

function isDateRange(value: string): value is DateRange {
  return (DATE_RANGE_ORDER as readonly string[]).includes(value)
}

// The single-value filters all change the same way: patch the URL param, then
// capture. `source: "watch"` separates these from the file browser's captures
// of the same events.
const FILTER_EVENTS = {
  agency: { event: "agency_filter_applied", prop: "agency" },
  dateRange: { event: "date_range_filter_applied", prop: "date_range" },
  release: { event: "release_filter_applied", prop: "release" },
} as const

/**
 * URL-backed filter state for the watch feed, plus the change handlers the
 * filter drawer needs. `onChange` runs after every filter change so the feed
 * can reset its scroll position (the shuffle seed is left alone — filters
 * narrow/widen the same shuffled order).
 */
export function useFeedFilters(onChange: () => void) {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: true,
  })

  const releasesQuery = trpc.releases.list.useQuery()
  const releasesList = releasesQuery.data ?? []
  const selectedReleaseId = filters.release
    ? releasesList.find((r) => r.name === filters.release)?.id
    : undefined

  const feedFilters = {
    agency: filters.agency || undefined,
    dateRange: isDateRange(filters.dateRange) ? filters.dateRange : undefined,
    releaseId: selectedReleaseId,
    tags: filters.tag ? filters.tag.split(",") : undefined,
  }

  // A release name in the URL can't filter anything until the releases list
  // resolves it to an id — hold the feed rather than flashing an unfiltered
  // one first. (An unknown name resolves to undefined and falls through.)
  const waitingForRelease = Boolean(filters.release) && releasesQuery.isLoading

  const hasActiveFilters = Boolean(
    filters.agency || filters.dateRange || filters.release || filters.tag
  )

  const applyFilters = useCallback(
    (patch: Partial<Record<keyof typeof filterParsers, string | null>>) => {
      setFilters(patch)
      onChange()
    },
    [setFilters, onChange]
  )

  const onFilterChange = useCallback(
    (key: keyof typeof FILTER_EVENTS, val: string | null) => {
      applyFilters({ [key]: val })
      if (val) {
        const { event, prop } = FILTER_EVENTS[key]
        posthog.capture(event, { [prop]: val, source: "watch" })
      }
    },
    [applyFilters]
  )

  const onTagChange = useCallback(
    (slug: string | null) => {
      if (!slug) {
        applyFilters({ tag: null })
        return
      }
      const { added, value } = toggleTagParam(filters.tag, slug)
      applyFilters({ tag: value })
      if (added) {
        posthog.capture("tag_filter_applied", { tag: slug, source: "watch" })
      }
    },
    [applyFilters, filters.tag]
  )

  const onClearFilters = useCallback(() => {
    applyFilters({ agency: null, dateRange: null, release: null, tag: null })
    posthog.capture("filters_cleared", { source: "watch" })
  }, [applyFilters])

  return {
    feedFilters,
    filters,
    handlers: {
      onAgencyChange: (val: string | null) => onFilterChange("agency", val),
      onClearFilters,
      onDateRangeChange: (val: string | null) =>
        onFilterChange("dateRange", val),
      onReleaseChange: (val: string | null) => onFilterChange("release", val),
      onTagChange,
    },
    hasActiveFilters,
    releasesList,
    waitingForRelease,
  }
}
