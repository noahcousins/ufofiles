import { router } from "./init"
import { bookmarksRouter } from "./routers/bookmarks"
import { clipsRouter } from "./routers/clips"
import { collectionsRouter } from "./routers/collections"
import { filesRouter } from "./routers/files"
import { libraryRouter } from "./routers/library"
import { meRouter } from "./routers/me"
import { releasesRouter } from "./routers/releases"
import { telemetryRouter } from "./routers/telemetry"

export const appRouter = router({
  files: filesRouter,
  releases: releasesRouter,
  telemetry: telemetryRouter,
  bookmarks: bookmarksRouter,
  clips: clipsRouter,
  collections: collectionsRouter,
  library: libraryRouter,
  me: meRouter,
})

export type AppRouter = typeof appRouter
