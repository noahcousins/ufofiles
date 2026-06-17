import type { Metadata } from "next"
import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { Globe } from "./_components/globe"

export const metadata: Metadata = {
  title: "UFO & UAP Incident Map - [ufo]files",
  description:
    "Explore UFO and UAP files by reported location on an interactive map.",
  alternates: {
    canonical: "/map",
  },
}

export default async function GlobePage() {
  await trpc.files.locations.prefetch()

  return (
    <HydrateClient>
      <Suspense fallback={<GlobeLoading />}>
        <Globe />
      </Suspense>
    </HydrateClient>
  )
}

function GlobeLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Spinner />
    </div>
  )
}
