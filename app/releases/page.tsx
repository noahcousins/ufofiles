import type { Metadata } from "next"
import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { ReleasesPage } from "./_components/releases-page"

export const metadata: Metadata = {
  title: "Releases | [ufo]files",
  description:
    "Download complete release archives of declassified UFO and UAP files.",
}

export default async function Page() {
  await trpc.releases.downloads.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<ReleasesLoading />}>
        <ReleasesPage />
      </Suspense>
    </HydrateClient>
  )
}

function ReleasesLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">
        Loading releases...
      </div>
    </div>
  )
}
