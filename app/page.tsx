import type { Metadata } from "next"
import { Suspense } from "react"
import {
  FileBrowser,
  FileBrowserSkeleton,
} from "@/components/files/file-browser"
import { HydrateClient, trpc } from "@/lib/trpc/server"

const RELEASE_OG_IMAGES: Record<
  string,
  { title: string; description: string; image: string }
> = {
  "release-2": {
    title: "Official UFO Files Release 02 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from May 2026.",
    image: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-02-og-image.jpg`,
  },
  "release-3": {
    title: "Official UFO Files Release 03 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from June 12, 2026.",
    image: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-03-og-image-v2.jpg`,
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

export default async function HomePage({
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

  // A deep link (e.g. the feed's "Details") arrives as `?fileId=<id>`. Surface
  // that file first in the list query so its modal opens without paging to it;
  // it's still subject to the active filters server-side.
  const fileIdParam =
    typeof params.fileId === "string" ? Number(params.fileId) : Number.NaN
  const priorityId =
    Number.isInteger(fileIdParam) && fileIdParam > 0 ? fileIdParam : undefined

  // biome-ignore lint/complexity/noVoid: fire-and-forget RSC prefetch
  void trpc.releases.list.prefetch()
  // biome-ignore lint/complexity/noVoid: fire-and-forget RSC prefetch
  void trpc.files.list.prefetchInfinite(
    { search, agency, type, dateRange, pageSize: 48, sortBy, priorityId },
    { initialCursor: 1 }
  )
  // biome-ignore lint/complexity/noVoid: fire-and-forget RSC prefetch
  void trpc.files.agencies.prefetch()
  // biome-ignore lint/complexity/noVoid: fire-and-forget RSC prefetch
  void trpc.files.typeCounts.prefetch({ search, agency, dateRange })
  // biome-ignore lint/complexity/noVoid: fire-and-forget RSC prefetch
  void trpc.files.dateRangeCounts.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<FileBrowserSkeleton />}>
        <FileBrowser />
      </Suspense>
    </HydrateClient>
  )
}
