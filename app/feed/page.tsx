import type { Metadata } from "next"
import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { VideoFeed } from "./_components/video-feed"

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

export default async function FeedPage() {
  void trpc.files.videoFeed.prefetchInfinite(
    { pageSize: 5, seed: "default" },
    { initialCursor: 1 }
  )

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
