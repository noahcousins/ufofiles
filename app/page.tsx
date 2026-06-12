import type { Metadata } from "next"
import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { VideoFeed } from "./feed/_components/video-feed"

export const metadata: Metadata = {
  title: "UFO & UAP Video Feed | [ufo]files",
  description:
    "Watch declassified government UFO and UAP videos in a continuous feed.",
  openGraph: {
    title: "UFO & UAP Video Feed | [ufo]files",
    description:
      "Watch declassified government UFO and UAP videos in a continuous feed.",
  },
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  void trpc.files.videoFeed.prefetchInfinite(
    { pageSize: 5, seed: "default" },
    { initialCursor: 1 }
  )

  // Share links land on a specific video (`/?v=<id>`). Prefetch it so the
  // pinned video is ready at hydration and the feed doesn't spin first.
  const params = await searchParams
  const v = typeof params.v === "string" ? Number(params.v) : Number.NaN
  if (Number.isInteger(v) && v > 0) {
    void trpc.files.feedVideoById.prefetch({ id: v })
  }

  return (
    <HydrateClient>
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        }
      >
        <VideoFeed />
      </Suspense>
    </HydrateClient>
  )
}
