import { asc, count, desc, eq, sum } from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { publicFileColumns } from "@/lib/db/file-columns"
import { files, releaseDownloads, releases } from "@/lib/db/schema"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const ONE_DAY = 24 * 60 * 60

export const releasesRouter = router({
  list: rateLimitedProcedure("query").query(async () =>
    withCache("releases:list:v2", ONE_DAY, async () => {
      const result = await db
        .select({
          id: releases.id,
          name: releases.name,
          title: releases.title,
          releaseDate: releases.releaseDate,
          description: releases.description,
          createdAt: releases.createdAt,
          fileCount: count(files.id),
          totalSize: sum(files.fileSize),
        })
        .from(releases)
        .leftJoin(files, eq(releases.id, files.releaseId))
        .groupBy(releases.id)
        .orderBy(desc(releases.releaseDate))

      return result
    })
  ),

  byId: rateLimitedProcedure("query")
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) =>
      // v2: files now use the shared public projection (was a bare select() that
      // leaked textContent + extraction* internal columns).
      withCache(cacheKey("releases:byId:v2", input), ONE_DAY, async () => {
        const [release] = await db
          .select()
          .from(releases)
          .where(eq(releases.id, input.id))
          .limit(1)

        if (!release) {
          return null
        }

        const releaseFiles = await db
          .select(publicFileColumns)
          .from(files)
          .where(eq(files.releaseId, input.id))

        return { ...release, files: releaseFiles }
      })
    ),

  downloads: rateLimitedProcedure("query").query(async () =>
    withCache("releases:downloads:v2", ONE_DAY, async () => {
      const result = await db.query.releases.findMany({
        orderBy: desc(releases.releaseDate),
        with: {
          releaseDownloads: {
            orderBy: asc(releaseDownloads.sortOrder),
          },
        },
      })

      return result.filter((r) => r.releaseDownloads.length > 0)
    })
  ),
})
