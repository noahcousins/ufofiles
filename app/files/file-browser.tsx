"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import posthog from "posthog-js"
import { useCallback, useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"
import { loadManifest } from "@/lib/file-cache"
import { trpc } from "@/lib/trpc/client"
import { FileCard, SkeletonCard } from "./file-card"
import { FileFilters, FileFiltersSkeleton } from "./file-filters"
import { SiteHeader } from "./site-header"

const PAGE_SIZE = 48

const filterParsers = {
  search: parseAsString.withDefault(""),
  agency: parseAsString.withDefault(""),
  type: parseAsString.withDefault(""),
  dateRange: parseAsString.withDefault(""),
  sort: parseAsString.withDefault("newest"),
  fileId: parseAsInteger.withOptions({ history: "push" }),
}

export function FileBrowser() {
  const recordView = trpc.telemetry.recordView.useMutation()
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: true,
  })

  const searchParams = useSearchParams()

  useEffect(() => {
    loadManifest()
  }, [])

  const [searchInput, setSearchInput] = useState(filters.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        setFilters({ search: value || null })
        if (value) {
          posthog.capture("search_performed", { query: value })
        }
      }, 300)
    },
    [setFilters]
  )

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    },
    []
  )

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.files.list.useInfiniteQuery(
      {
        search: searchParams.get("search") || undefined,
        agency: searchParams.get("agency") || undefined,
        type:
          (searchParams.get("type") as "image" | "video" | "pdf" | "other") ||
          undefined,
        dateRange:
          (searchParams.get("dateRange") as
            | "2010-now"
            | "2000s"
            | "1960-2000"
            | "pre-1960") || undefined,
        pageSize: PAGE_SIZE,
        sortBy:
          (searchParams.get("sort") as
            | "newest"
            | "oldest"
            | "most-views"
            | "least-views") || "newest",
      },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    )

  const allItems = (data?.pages.flatMap((p) => p.items) ?? []).filter(
    (item, _i, arr) => arr.findIndex((f) => f.id === item.id) === _i
  )
  const total = data?.pages[0]?.total ?? null

  useEffect(() => {
    function handleScroll() {
      if (!hasNextPage || isFetchingNextPage) {
        return
      }
      const scrollBottom = window.innerHeight + window.scrollY
      if (scrollBottom >= document.body.offsetHeight - 400) {
        fetchNextPage()
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const fileIds = allItems.map((f) => f.id)
  const { data: viewCounts } = trpc.telemetry.viewCounts.useQuery(
    { fileIds },
    {
      enabled: fileIds.length > 0,
      refetchInterval: 2 * 60 * 1000,
      placeholderData: keepPreviousData,
    }
  )

  const [agencies] = trpc.files.agencies.useSuspenseQuery()
  const [typeCounts] = trpc.files.typeCounts.useSuspenseQuery()
  const [dateRangeCounts] = trpc.files.dateRangeCounts.useSuspenseQuery()

  return (
    <>
      <SiteHeader>
        <FileFilters
          agencies={agencies}
          agency={filters.agency}
          dateRange={filters.dateRange}
          dateRangeCounts={dateRangeCounts}
          onAgencyChange={(val) => {
            setFilters({ agency: val })
            if (val) {
              posthog.capture("agency_filter_applied", { agency: val })
            }
          }}
          onClearFilters={() => {
            setFilters({
              search: null,
              agency: null,
              type: null,
              dateRange: null,
              sort: null,
            })
            posthog.capture("filters_cleared")
          }}
          onDateRangeChange={(val) => {
            setFilters({ dateRange: val })
            if (val) {
              posthog.capture("date_range_filter_applied", { date_range: val })
            }
          }}
          onSearchChange={handleSearchChange}
          onSortChange={(val) => {
            setFilters({ sort: val })
            posthog.capture("sort_changed", { sort: val })
          }}
          onTypeChange={(val) => {
            setFilters({ type: val })
            if (val) {
              posthog.capture("type_filter_applied", { file_type: val })
            }
          }}
          searchInput={searchInput}
          sort={filters.sort}
          totalDocuments={total}
          type={filters.type}
          typeCounts={typeCounts}
        />
      </SiteHeader>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: PAGE_SIZE / 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No files found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {allItems.map((file, index) => (
              <FileCard
                currentIndex={index}
                file={file}
                isOpen={filters.fileId === file.id}
                key={file.id}
                nextFileId={
                  index < allItems.length - 1 ? allItems[index + 1].id : null
                }
                onNavigate={(fileId) => {
                  recordView.mutate({ fileId })
                  setFilters({ fileId })
                }}
                onOpenChange={(open) => {
                  if (open) {
                    recordView.mutate({ fileId: file.id })
                    posthog.capture("file_opened", {
                      file_id: file.id,
                      file_title: file.title,
                      file_agency: file.agency,
                      file_type: file.mimeType,
                    })
                  }
                  setFilters({ fileId: open ? file.id : null })
                }}
                prevFileId={index > 0 ? allItems[index - 1].id : null}
                totalFiles={total ?? allItems.length}
                viewData={viewCounts?.[file.id]}
              />
            ))}
          </div>
        )}

        {isFetchingNextPage && (
          <div className="flex justify-center py-8">
            <Spinner className="text-lg" />
          </div>
        )}
      </div>
    </>
  )
}

/** Full-page skeleton shown inside the Suspense fallback on initial load */
export function FileBrowserSkeleton() {
  return (
    <>
      <SiteHeader>
        <FileFiltersSkeleton />
      </SiteHeader>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE / 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </>
  )
}
