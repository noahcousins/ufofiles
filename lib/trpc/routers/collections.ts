import { TRPCError } from "@trpc/server"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { bookmarks, clips, collectionMarks, collections } from "@/lib/db/schema"
import { router } from "../init"
import { protectedProcedure } from "../procedures"

const markTypeSchema = z.enum(["bookmark", "clip"])

async function assertOwnsCollection(userId: string, collectionId: number) {
  const owned = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, collectionId),
      eq(collections.userId, userId)
    ),
  })
  if (!owned) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" })
  }
}

async function assertOwnsMark(
  userId: string,
  markType: "bookmark" | "clip",
  markId: number
) {
  const table = markType === "bookmark" ? bookmarks : clips
  const owned = await db.query[
    markType === "bookmark" ? "bookmarks" : "clips"
  ].findFirst({
    where: and(eq(table.id, markId), eq(table.userId, userId)),
  })
  if (!owned) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mark not found" })
  }
}

export const collectionsRouter = router({
  // Names need not be unique within a Library (ADR-0003 / CONTEXT).
  create: protectedProcedure("mutation")
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .insert(collections)
        .values({ userId: ctx.user.id, name: input.name })
        .returning()
      return row
    }),

  rename: protectedProcedure("mutation")
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .update(collections)
        .set({ name: input.name })
        .where(
          and(eq(collections.id, input.id), eq(collections.userId, ctx.user.id))
        )
        .returning()
      return row ?? null
    }),

  // Deletes only the grouping — the marks stay in the Library (the cascade
  // removes collection_marks rows, not the marks they point at).
  remove: protectedProcedure("mutation")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await db
        .delete(collections)
        .where(
          and(eq(collections.id, input.id), eq(collections.userId, ctx.user.id))
        )
        .returning({ id: collections.id })
      return { removed: deleted.length > 0 }
    }),

  addMark: protectedProcedure("mutation")
    .input(
      z.object({
        collectionId: z.number().int().positive(),
        markType: markTypeSchema,
        markId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertOwnsCollection(ctx.user.id, input.collectionId)
      await assertOwnsMark(ctx.user.id, input.markType, input.markId)
      await db
        .insert(collectionMarks)
        .values({
          collectionId: input.collectionId,
          markType: input.markType,
          markId: input.markId,
        })
        .onConflictDoNothing()
      return { added: true }
    }),

  removeMark: protectedProcedure("mutation")
    .input(
      z.object({
        collectionId: z.number().int().positive(),
        markType: markTypeSchema,
        markId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertOwnsCollection(ctx.user.id, input.collectionId)
      await db
        .delete(collectionMarks)
        .where(
          and(
            eq(collectionMarks.collectionId, input.collectionId),
            eq(collectionMarks.markType, input.markType),
            eq(collectionMarks.markId, input.markId)
          )
        )
      return { removed: true }
    }),

  list: protectedProcedure("query")
    .input(z.void())
    .query(async ({ ctx }) => {
      const rows = await db
        .select({
          id: collections.id,
          name: collections.name,
          createdAt: collections.createdAt,
          markCount: sql<number>`cast(count(${collectionMarks.markId}) as int)`,
        })
        .from(collections)
        .leftJoin(
          collectionMarks,
          eq(collectionMarks.collectionId, collections.id)
        )
        .where(eq(collections.userId, ctx.user.id))
        .groupBy(collections.id)
        .orderBy(collections.createdAt)
      return rows
    }),

  // The mark memberships for a set of the user's collections, so the Library
  // can show which collections a mark belongs to.
  memberships: protectedProcedure("query")
    .input(z.void())
    .query(async ({ ctx }) => {
      const owned = await db
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.userId, ctx.user.id))
      const ids = owned.map((c) => c.id)
      if (ids.length === 0) {
        return []
      }
      return db
        .select({
          collectionId: collectionMarks.collectionId,
          markType: collectionMarks.markType,
          markId: collectionMarks.markId,
        })
        .from(collectionMarks)
        .where(inArray(collectionMarks.collectionId, ids))
    }),
})
