import { router } from "./init"
import { filesRouter } from "./routers/files"
import { releasesRouter } from "./routers/releases"
import { telemetryRouter } from "./routers/telemetry"

export const appRouter = router({
  files: filesRouter,
  releases: releasesRouter,
  telemetry: telemetryRouter,
})

export type AppRouter = typeof appRouter
