import { and, count, eq, inArray } from "drizzle-orm"
import { z } from "zod/v4"
import { cacheKey, withCache } from "@/lib/cache"
import { db } from "@/lib/db"
import { bookmarks, collectionMarks } from "@/lib/db/schema"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import { rateLimitedProcedure } from "../rateLimit"

const COUNTS_TTL = 60

export const bookmarksRouter = router({
  // Creating the first mark is what turns a visitor into a Guest — the client
  // signs in anonymously before calling this, so a session always exists here.
  // No resource key: the rate limit is a global per-user (and per-IP for
  // Guests) write cap, not a per-file one.
  create: protectedProcedure("mutation")
    .input(
      z.object({
        fileId: z.number().int().positive(),
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .insert(bookmarks)
        .values({
          userId: ctx.user.id,
          fileId: input.fileId,
          note: input.note,
        })
        .onConflictDoNothing({
          target: [bookmarks.userId, bookmarks.fileId],
        })
        .returning()

      // Already bookmarked — return the existing row so the call is idempotent.
      if (!row) {
        const existing = await db.query.bookmarks.findFirst({
          where: and(
            eq(bookmarks.userId, ctx.user.id),
            eq(bookmarks.fileId, input.fileId)
          ),
        })
        return existing ?? null
      }
      return row
    }),

  remove: protectedProcedure("mutation")
    .input(z.object({ fileId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await db
        .delete(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, ctx.user.id),
            eq(bookmarks.fileId, input.fileId)
          )
        )
        .returning({ id: bookmarks.id })

      // Detach the deleted Bookmark from any Collections (no FK on the
      // polymorphic membership rows).
      for (const { id } of deleted) {
        await db
          .delete(collectionMarks)
          .where(
            and(
              eq(collectionMarks.markType, "bookmark"),
              eq(collectionMarks.markId, id)
            )
          )
      }

      return { removed: deleted.length > 0 }
    }),

  // Which of the user's files are bookmarked — drives the feed's toggle state.
  fileIds: protectedProcedure("query")
    .input(z.void())
    .query(async ({ ctx }) => {
      const rows = await db
        .select({ fileId: bookmarks.fileId })
        .from(bookmarks)
        .where(eq(bookmarks.userId, ctx.user.id))
      return rows.map((r) => r.fileId)
    }),

  // Aggregate bookmark count per File (across all Users, Guests included), for
  // the feed's social-proof counter. Public and cached briefly.
  counts: rateLimitedProcedure("query")
    .input(z.object({ fileIds: z.array(z.number().int().positive()).max(100) }))
    .query(({ input }) => {
      const { fileIds } = input
      const sortedIds = [...fileIds].sort((a, b) => a - b)

      return withCache(
        cacheKey("bookmarks:counts:v1", { fileIds: sortedIds }),
        COUNTS_TTL,
        async () => {
          const result: Record<number, number> = {}
          for (const id of fileIds) {
            result[id] = 0
          }
          if (fileIds.length === 0) {
            return result
          }

          const rows = await db
            .select({ fileId: bookmarks.fileId, total: count() })
            .from(bookmarks)
            .where(inArray(bookmarks.fileId, fileIds))
            .groupBy(bookmarks.fileId)

          for (const row of rows) {
            result[row.fileId] = row.total
          }
          return result
        }
      )
    }),
})
