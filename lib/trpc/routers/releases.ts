import { asc, count, eq, sum } from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { files, releases } from "@/lib/db/schema"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const ONE_DAY = 24 * 60 * 60

export const releasesRouter = router({
  list: rateLimitedProcedure("query").query(async () =>
    withCache("releases:list", ONE_DAY, async () => {
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
        .orderBy(asc(releases.name))

      return result
    })
  ),

  byId: rateLimitedProcedure("query")
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) =>
      withCache(cacheKey("releases:byId", input), ONE_DAY, async () => {
        const [release] = await db
          .select()
          .from(releases)
          .where(eq(releases.id, input.id))
          .limit(1)

        if (!release) {
          return null
        }

        const releaseFiles = await db
          .select()
          .from(files)
          .where(eq(files.releaseId, input.id))

        return { ...release, files: releaseFiles }
      })
    ),
})
