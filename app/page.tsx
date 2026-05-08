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

  void trpc.files.list.prefetchInfinite(
    { search, agency, type, pageSize: 48 },
    { initialCursor: 1 }
  )
  void trpc.files.agencies.prefetch()
  void trpc.files.typeCounts.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<FileBrowserSkeleton />}>
        <FileBrowser />
      </Suspense>
    </HydrateClient>
  )
}
