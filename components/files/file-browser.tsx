"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import posthog from "posthog-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { Header } from "@/components/layout/header"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/lib/auth/session-provider"
import { loadManifest } from "@/lib/file-cache"
import { trpc } from "@/lib/trpc/client"
import { FileCard, SkeletonCard } from "./file-card"
import { FileFilters, FileFiltersSkeleton } from "./file-filters"
import { toggleTagParam } from "./filter-controls"
import { ScrollUpsellDialog } from "./scroll-upsell-dialog"

const PAGE_SIZE = 48

/**
 * Guests can browse this many files into the current result set. Scrolling
 * past the Nth card opens the sign-up modal (and further pages stop loading)
 * until they sign in. Depth is measured against the current results, so a
 * filter or search change starts the count over instead of firing the gate
 * on the freshly-narrowed list. Signed-in users are never gated.
 */
const GUEST_FILE_LIMIT = 72

/**
 * Cards rendered past the limit for guests, faded out under the gradient and
 * inert. One desktop row: enough to show the archive continues, without
 * handing over anything usable.
 */
const GUEST_FADE_CARDS = 4

/**
 * Depth milestones reported to PostHog for every visitor (guest or not), once
 * each per result set. Gives the browse-depth funnel independently of where
 * the gate happens to sit, so the limit can be tuned later with evidence.
 */
const DEPTH_MILESTONES = [48, 72, 96]

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

  // A deep link (e.g. the feed's "Details") lands with `?fileId` set. Pass it
  // once as the list query's priorityId so that file sorts to the front of the
  // real (still-filtered) results and its modal opens without paging to it.
  // Captured on mount so clicking around the grid doesn't re-sort it.
  const priorityIdRef = useRef(filters.fileId)

  const {
    data,
    isLoading,
    isPlaceholderData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.files.list.useInfiniteQuery(
    {
      priorityId: priorityIdRef.current ?? undefined,
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
  const loadedCount = allItems.length

  // Guest scroll gate. While the session is still resolving we neither fetch
  // nor gate, so a signed-in user never sees the modal flash on load.
  const { data: session, isPending: sessionPending } = useSession()
  const openAuth = useAuthDialog()
  const isGuest = !(session || sessionPending)

  const [upsellOpen, setUpsellOpen] = useState(false)
  // The gate is edge-triggered: it fires when a scroll carries the guest
  // across the limit, then disarms until they're back above it. Dismissing
  // the modal therefore doesn't reopen it on the next scroll tick, and a
  // filter change (which disarms below) never fires it on the narrowed list
  // just because the page was already scrolled deep.
  const upsellArmedRef = useRef(true)
  const gridRef = useRef<HTMLDivElement>(null)
  const mountedAtRef = useRef(Date.now())
  // Milestones already reported for the current result set.
  const milestonesSentRef = useRef(new Set<number>())
  const resultKey = JSON.stringify([
    searchParams.get("search"),
    searchParams.get("agency"),
    searchParams.get("type"),
    searchParams.get("dateRange"),
    selectedReleaseId,
    searchParams.get("tag"),
    searchParams.get("sort"),
  ])
  // biome-ignore lint/correctness/useExhaustiveDependencies: resultKey is the trigger, not an input — every new result set restarts the depth count
  useEffect(() => {
    milestonesSentRef.current = new Set()
    upsellArmedRef.current = false
  }, [resultKey])

  const openUpsell = useCallback(
    (mode: "signin" | "signup") => {
      posthog.capture("scroll_upsell_clicked", { mode })
      setUpsellOpen(false)
      openAuth(mode, undefined, "unlimited")
    },
    [openAuth]
  )

  // The paywall: guests get the limit plus a faded, inert row, and nothing
  // past that reaches the DOM. Only kicks in once the results actually exceed
  // the limit, so short result sets never show a fade.
  const guestWall = isGuest && allItems.length > GUEST_FILE_LIMIT
  const visibleItems = guestWall
    ? allItems.slice(0, GUEST_FILE_LIMIT + GUEST_FADE_CARDS)
    : allItems
  // What the file viewer's next/prev arrows may walk: never past the wall.
  const navItems = guestWall ? allItems.slice(0, GUEST_FILE_LIMIT) : allItems

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadedCount re-runs the handler after the grid resizes; see the comment below
  useEffect(() => {
    function handleScroll() {
      // While a filter change is in flight the grid still shows the previous
      // results (keepPreviousData); depth against those would be wrong.
      if (sessionPending || isPlaceholderData) {
        return
      }
      const filesSeen = countFilesSeen(gridRef.current)
      const secondsOnPage = Math.round(
        (Date.now() - mountedAtRef.current) / 1000
      )

      reportDepthMilestones(milestonesSentRef.current, filesSeen, {
        seconds_on_page: secondsOnPage,
        signed_in: Boolean(session),
      })

      if (isGuest && filesSeen >= GUEST_FILE_LIMIT) {
        if (!upsellArmedRef.current) {
          return
        }
        upsellArmedRef.current = false
        posthog.capture("scroll_upsell_shown", {
          files_seen: filesSeen,
          seconds_on_page: secondsOnPage,
          source: "scroll",
        })
        setUpsellOpen(true)
        return
      }
      upsellArmedRef.current = true

      if (!hasNextPage || isFetchingNextPage) {
        return
      }
      const scrollBottom = window.innerHeight + window.scrollY
      if (scrollBottom >= document.body.offsetHeight - 400) {
        fetchNextPage()
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // Also re-evaluate whenever the grid changes size: a filter that shrinks
    // the results doesn't fire a scroll event even though the viewport is now
    // at (or past) the new bottom.
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isGuest,
    session,
    sessionPending,
    isPlaceholderData,
    loadedCount,
  ])

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
            const { added, value } = toggleTagParam(filters.tag, slug)
            setFilters({ tag: value })
            if (added) {
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
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4"
            ref={gridRef}
          >
            {visibleItems.map((file, index) => {
              const card = (
                <FileCard
                  currentIndex={index}
                  file={file}
                  isOpen={filters.fileId === file.id}
                  key={file.id}
                  nextFileId={
                    index + 1 < navItems.length ? navItems[index + 1].id : null
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
                  prevFileId={
                    index > 0 && index < navItems.length
                      ? navItems[index - 1].id
                      : null
                  }
                  totalFiles={total ?? allItems.length}
                  viewData={viewCounts?.[file.id]}
                />
              )
              // Past the limit: visible under the fade, but inert.
              return guestWall && index >= GUEST_FILE_LIMIT ? (
                <div
                  aria-hidden
                  className="pointer-events-none select-none"
                  inert
                  key={file.id}
                >
                  {card}
                </div>
              ) : (
                card
              )
            })}
          </div>
        )}

        {guestWall ? (
          <GuestWall
            onOpen={() => {
              // Disarm so closing the modal (still at the bottom) doesn't
              // let the scroll trigger reopen it immediately.
              upsellArmedRef.current = false
              posthog.capture("scroll_upsell_shown", { source: "wall" })
              setUpsellOpen(true)
            }}
          />
        ) : (
          isFetchingNextPage && (
            <div className="flex justify-center py-8">
              <Spinner className="text-lg" />
            </div>
          )
        )}
      </div>

      <ScrollUpsellDialog
        onLogIn={() => openUpsell("signin")}
        onOpenChange={setUpsellOpen}
        onSignUp={() => openUpsell("signup")}
        open={upsellOpen}
        remaining={
          total === null ? null : total - Math.min(total, GUEST_FILE_LIMIT)
        }
      />
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

/** Fire each unreached milestone at or below `filesSeen`, once per result set. */
function reportDepthMilestones(
  sent: Set<number>,
  filesSeen: number,
  props: { seconds_on_page: number; signed_in: boolean }
) {
  for (const milestone of DEPTH_MILESTONES) {
    if (filesSeen >= milestone && !sent.has(milestone)) {
      sent.add(milestone)
      posthog.capture("browse_depth_reached", { files: milestone, ...props })
    }
  }
}

/**
 * How many cards the viewport has reached: the count of grid children whose
 * top edge is above the bottom of the window. Children are in DOM order and
 * laid out top-to-bottom, so the scan stops at the first one still below.
 */
function countFilesSeen(grid: HTMLDivElement | null): number {
  if (!grid) {
    return 0
  }
  const limit = window.innerHeight
  let seen = 0
  for (const child of grid.children) {
    if (child.getBoundingClientRect().top >= limit) {
      break
    }
    seen++
  }
  return seen
}

/**
 * Newspaper-style cut-off under the guest grid: a gradient that fades the
 * inert overflow row into the background, then a single line back into the
 * sign-up modal. The grid itself simply ends here — nothing past the limit
 * is rendered, so there is nothing further to scroll to.
 */
function GuestWall({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-80 h-80 bg-gradient-to-b from-transparent via-background/80 to-background"
      />
      <div className="relative flex justify-center pt-2 pb-10">
        <button
          className="text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
          onClick={onOpen}
          type="button"
        >
          Sign up to keep browsing
        </button>
      </div>
    </div>
  )
}
