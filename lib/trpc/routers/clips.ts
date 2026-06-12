import { and, eq } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { clips, collectionMarks } from "@/lib/db/schema"
import { router } from "../init"
import { protectedProcedure } from "../procedures"

export const clipsRouter = router({
  // Global per-user (and per-IP for Guests) write cap — no per-file key.
  create: protectedProcedure("mutation")
    .input(
      z
        .object({
          fileId: z.number().int().positive(),
          startSeconds: z.number().int().min(0),
          endSeconds: z.number().int().min(0),
          note: z.string().max(2000).optional(),
        })
        .refine((c) => c.endSeconds > c.startSeconds, {
          message: "endSeconds must be greater than startSeconds",
          path: ["endSeconds"],
        })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .insert(clips)
        .values({
          userId: ctx.user.id,
          fileId: input.fileId,
          startSeconds: input.startSeconds,
          endSeconds: input.endSeconds,
          note: input.note,
        })
        // Exact-bounds dedupe — re-adding the same range is a no-op.
        .onConflictDoNothing({
          target: [
            clips.userId,
            clips.fileId,
            clips.startSeconds,
            clips.endSeconds,
          ],
        })
        .returning()

      if (!row) {
        const existing = await db.query.clips.findFirst({
          where: and(
            eq(clips.userId, ctx.user.id),
            eq(clips.fileId, input.fileId),
            eq(clips.startSeconds, input.startSeconds),
            eq(clips.endSeconds, input.endSeconds)
          ),
        })
        return existing ?? null
      }
      return row
    }),

  update: protectedProcedure("mutation")
    .input(
      z.object({
        id: z.number().int().positive(),
        startSeconds: z.number().int().min(0).optional(),
        endSeconds: z.number().int().min(0).optional(),
        note: z.string().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...changes } = input
      const [row] = await db
        .update(clips)
        .set(changes)
        .where(and(eq(clips.id, id), eq(clips.userId, ctx.user.id)))
        .returning()
      return row ?? null
    }),

  remove: protectedProcedure("mutation")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const deleted = await db
        .delete(clips)
        .where(and(eq(clips.id, input.id), eq(clips.userId, ctx.user.id)))
        .returning({ id: clips.id })

      for (const { id } of deleted) {
        await db
          .delete(collectionMarks)
          .where(
            and(
              eq(collectionMarks.markType, "clip"),
              eq(collectionMarks.markId, id)
            )
          )
      }

      return { removed: deleted.length > 0 }
    }),
})
