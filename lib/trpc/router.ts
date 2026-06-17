import { router } from "./init"
import { accountRouter } from "./routers/account"
import { bookmarksRouter } from "./routers/bookmarks"
import { clipsRouter } from "./routers/clips"
import { collectionsRouter } from "./routers/collections"
import { filesRouter } from "./routers/files"
import { libraryRouter } from "./routers/library"
import { marketingRouter } from "./routers/marketing"
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
  marketing: marketingRouter,
  me: meRouter,
  account: accountRouter,
})

export type AppRouter = typeof appRouter
