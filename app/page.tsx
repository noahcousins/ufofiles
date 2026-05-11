import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { FileBrowser, FileBrowserSkeleton } from "./files/file-browser"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const search = typeof params.search === "string" ? params.search : undefined
  const agency = typeof params.agency === "string" ? params.agency : undefined
  const type =
    typeof params.type === "string"
      ? (params.type as "image" | "video" | "pdf" | "other")
      : undefined
  const dateRange =
    typeof params.dateRange === "string"
      ? (params.dateRange as "2010-now" | "2000s" | "1960-2000" | "pre-1960")
      : undefined
  const sortBy =
    typeof params.sort === "string"
      ? (params.sort as "newest" | "oldest" | "most-views" | "least-views")
      : "newest"

  void trpc.files.list.prefetchInfinite(
    { search, agency, type, dateRange, pageSize: 48, sortBy },
    { initialCursor: 1 }
  )
  void trpc.files.agencies.prefetch()
  void trpc.files.typeCounts.prefetch()
  void trpc.files.dateRangeCounts.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<FileBrowserSkeleton />}>
        <FileBrowser />
      </Suspense>
    </HydrateClient>
  )
}
