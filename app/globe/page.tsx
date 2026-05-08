import { Suspense } from "react"
import { HydrateClient, trpc } from "@/lib/trpc/server"
import { Globe } from "./globe"

export const metadata = {
  title: "Incident Map | [ufo]files",
  description: "Visualize UFO and UAP incident locations on a 3D globe",
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
      <div className="animate-pulse text-muted-foreground">
        Loading globe...
      </div>
    </div>
  )
}
