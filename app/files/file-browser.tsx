"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import posthog from "posthog-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/layout/header"
import { Spinner } from "@/components/ui/spinner"
import { loadManifest } from "@/lib/file-cache"
import { trpc } from "@/lib/trpc/client"
import { FileCard, SkeletonCard } from "./file-card"
import { FileFilters, FileFiltersSkeleton } from "./file-filters"

const PAGE_SIZE = 48

const filterParsers = {
  search: parseAsString.withDefault(""),
  agency: parseAsString.withDefault(""),
  type: parseAsString.withDefault(""),
  dateRange: parseAsString.withDefault(""),
  release: parseAsString.withDefault(""),
  tag: parseAsString.withDefault(""),
  sort: parseAsString.withDefault("most-views"),
  fileId: parseAsInteger.withOptions({ history: "push" }),
}

export function FileBrowser() {
  const recordView = trpc.telemetry.recordView.useMutation()
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: true,
  })

  const searchParams = useSearchParams()

  // Mobile search slide-open state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  // Open search if navigated here with ?searchOpen=1 (from other pages)
  useEffect(() => {
    if (searchParams.get("searchOpen") === "1") {
      setMobileSearchOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("searchOpen")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

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

  const [releasesList] = trpc.releases.list.useSuspenseQuery()

  const newestRelease = useMemo(
    () =>
      releasesList.length > 0
        ? releasesList.reduce((a, b) => {
            const aDate = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
            const bDate = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
            return bDate > aDate ? b : a
          })
        : null,
    [releasesList]
  )

  const isNewestReleaseNew = newestRelease?.releaseDate
    ? Date.now() - new Date(newestRelease.releaseDate).getTime() <
      7 * 24 * 60 * 60 * 1000
    : false

  const [seenNewestRelease, setSeenNewestRelease] = useState(() => {
    if (typeof window === "undefined") {
      return true
    }
    return localStorage.getItem("seen-newest-release") === newestRelease?.name
  })

  const markReleaseSeen = useCallback(() => {
    if (newestRelease) {
      localStorage.setItem("seen-newest-release", newestRelease.name)
      setSeenNewestRelease(true)
    }
  }, [newestRelease])

  const unseenNewReleaseName =
    isNewestReleaseNew && !seenNewestRelease ? newestRelease?.name : null

  const selectedReleaseId = filters.release
    ? releasesList.find((r) => r.name === filters.release)?.id
    : undefined

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
        releaseId: selectedReleaseId,
        tags: searchParams.get("tag")
          ? searchParams.get("tag")!.split(",")
          : undefined,
        pageSize: PAGE_SIZE,
        sortBy:
          (searchParams.get("sort") as
            | "newest"
            | "oldest"
            | "most-views"
            | "least-views") || "most-views",
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        placeholderData: keepPreviousData,
      }
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

  const crossFilters = {
    search: filters.search || undefined,
    agency: filters.agency || undefined,
    type: (filters.type as "image" | "video" | "pdf" | "other") || undefined,
    dateRange:
      (filters.dateRange as "2010-now" | "2000s" | "1960-2000" | "pre-1960") ||
      undefined,
    releaseId: selectedReleaseId,
    tags: filters.tag ? filters.tag.split(",") : undefined,
  }

  const { data: typeCounts, isPlaceholderData: typeCountsStale } =
    trpc.files.typeCounts.useQuery(crossFilters, {
      placeholderData: keepPreviousData,
    })

  const { data: dateRangeCounts } = trpc.files.dateRangeCounts.useQuery(
    crossFilters,
    { placeholderData: keepPreviousData }
  )

  const { data: tagsList } = trpc.files.tags.useQuery(crossFilters, {
    placeholderData: keepPreviousData,
  })

  const { data: releaseCounts } = trpc.files.releaseCounts.useQuery(
    crossFilters,
    { placeholderData: keepPreviousData }
  )

  return (
    <>
      <Header
        mobileSearchOpen={mobileSearchOpen}
        newReleaseName={unseenNewReleaseName}
        onMobileSearchToggle={() => setMobileSearchOpen((prev) => !prev)}
        onNewReleaseClick={markReleaseSeen}
      >
        <FileFilters
          agencies={agencies}
          agency={filters.agency}
          dateRange={filters.dateRange}
          dateRangeCounts={dateRangeCounts ?? []}
          mobileSearchOpen={mobileSearchOpen}
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
              release: null,
              tag: null,
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
          onMarkReleaseSeen={markReleaseSeen}
          onMobileSearchClose={() => setMobileSearchOpen(false)}
          onReleaseChange={(val) => {
            setFilters({ release: val })
            if (val) {
              posthog.capture("release_filter_applied", { release: val })
            }
          }}
          onSearchChange={handleSearchChange}
          onSortChange={(val) => {
            setFilters({ sort: val })
            posthog.capture("sort_changed", { sort: val })
          }}
          onTagChange={(slug) => {
            if (!slug) {
              setFilters({ tag: null })
              return
            }
            const current = filters.tag ? filters.tag.split(",") : []
            const next = current.includes(slug)
              ? current.filter((t) => t !== slug)
              : [...current, slug]
            setFilters({ tag: next.length > 0 ? next.join(",") : null })
            if (!current.includes(slug)) {
              posthog.capture("tag_filter_applied", { tag: slug })
            }
          }}
          onTypeChange={(val) => {
            setFilters({ type: val })
            if (val) {
              posthog.capture("type_filter_applied", { file_type: val })
            }
          }}
          release={filters.release}
          releaseCounts={releaseCounts}
          releases={releasesList}
          searchInput={searchInput}
          seenNewestRelease={seenNewestRelease}
          sort={filters.sort}
          tag={filters.tag}
          tags={tagsList ?? []}
          totalFiles={total}
          type={filters.type}
          typeCounts={typeCounts ?? []}
          typeCountsLoading={typeCountsStale}
        />
      </Header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: PAGE_SIZE / 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No files found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4">
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
      <Header>
        <FileFiltersSkeleton />
      </Header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE / 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </>
  )
}
