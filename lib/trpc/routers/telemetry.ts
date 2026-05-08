import { and, count, eq, gte, inArray } from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { router } from "../init"
import { rateLimitedProcedure } from "../rateLimit"

const TWO_MINUTES = 2 * 60

function computeHotScore(recentViews: number): number {
  if (recentViews >= 50) {
    return 4
  }
  if (recentViews >= 15) {
    return 3
  }
  if (recentViews >= 5) {
    return 2
  }
  if (recentViews >= 1) {
    return 1
  }
  return 0
}

export const telemetryRouter = router({
  recordView: rateLimitedProcedure(
    "view",
    (raw) => String((raw as { fileId: number }).fileId)
  )
    .input(z.object({ fileId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { fileId } = input
      const ip = ctx.clientIp ?? "unknown"

      await db.insert(events).values({
        fileId,
        type: "view",
        ip: ip === "unknown" ? null : ip,
      })

      return { counted: true }
    }),

  viewCounts: rateLimitedProcedure("query")
    .input(
      z.object({
        fileIds: z.array(z.number().int().positive()).max(100),
      })
    )
    .query(async ({ input }) => {
      const { fileIds } = input
      const sortedIds = [...fileIds].sort((a, b) => a - b)

      return withCache(
        cacheKey("telemetry:viewCounts", { fileIds: sortedIds }),
        TWO_MINUTES,
        async () => {
          const result: Record<
            number,
            { views: number; recentViews: number; hotScore: number }
          > = {}
          for (const id of fileIds) {
            result[id] = { views: 0, recentViews: 0, hotScore: 0 }
          }

          if (fileIds.length === 0) {
            return result
          }

          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

          const [totalRows, recentRows] = await Promise.all([
            db
              .select({
                fileId: events.fileId,
                views: count(),
              })
              .from(events)
              .where(
                and(inArray(events.fileId, fileIds), eq(events.type, "view"))
              )
              .groupBy(events.fileId),
            db
              .select({
                fileId: events.fileId,
                views: count(),
              })
              .from(events)
              .where(
                and(
                  inArray(events.fileId, fileIds),
                  eq(events.type, "view"),
                  gte(events.createdAt, oneHourAgo)
                )
              )
              .groupBy(events.fileId),
          ])

          for (const row of totalRows) {
            if (result[row.fileId]) {
              result[row.fileId].views = row.views
            }
          }

          for (const row of recentRows) {
            if (result[row.fileId]) {
              result[row.fileId].recentViews = row.views
              result[row.fileId].hotScore = computeHotScore(row.views)
            }
          }

          return result
        }
      )
    }),
})
