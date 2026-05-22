import type { Metadata } from "next"
import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { FileBrowser, FileBrowserSkeleton } from "./files/file-browser"

const RELEASE_OG_IMAGES: Record<
  string,
  { title: string; description: string; image: string }
> = {
  "release-2": {
    title: "Release 2 | [ufo]files",
    description: "Official release of declassified UFO and UAP files.",
    image: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-02-og-image.jpg`,
  },
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const params = await searchParams
  const release =
    typeof params.release === "string" ? params.release : undefined
  const og = release ? RELEASE_OG_IMAGES[release] : undefined

  if (!og) {
    return {}
  }

  return {
    title: og.title,
    description: og.description,
    openGraph: {
      title: og.title,
      description: og.description,
      images: [{ url: og.image }],
    },
    twitter: {
      card: "summary_large_image",
      title: og.title,
      description: og.description,
      images: [og.image],
    },
  }
}

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
      : "most-views"

  const release =
    typeof params.release === "string" ? params.release : undefined

  void trpc.releases.list.prefetch()
  void trpc.files.list.prefetchInfinite(
    { search, agency, type, dateRange, pageSize: 48, sortBy },
    { initialCursor: 1 }
  )
  void trpc.files.agencies.prefetch()
  void trpc.files.typeCounts.prefetch({ search, agency, dateRange })
  void trpc.files.dateRangeCounts.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<FileBrowserSkeleton />}>
        <FileBrowser />
      </Suspense>
    </HydrateClient>
  )
}
