import { TRPCError } from "@trpc/server"
import { and, count, eq, inArray, or } from "drizzle-orm"
import { z } from "zod/v4"
import {
  CLIP_RENDER_CONFIG,
  clipDownloadName,
  clipRenderObjectKey,
} from "@/lib/clips/config"
import { ensureClipRender } from "@/lib/clips/render"
import { db } from "@/lib/db"
import { clipRenders, clips } from "@/lib/db/schema"
import { getClipDownloadUrl } from "@/lib/r2"
import { router } from "../init"
import { memberProcedure } from "../procedures"

const withinMaxDuration = (c: { startSeconds: number; endSeconds: number }) =>
  c.endSeconds - c.startSeconds <= CLIP_RENDER_CONFIG.maxClipSeconds

const tooLongMessage = `Clip must be ${CLIP_RENDER_CONFIG.maxClipSeconds}s or shorter`

// Every clip operation is Member-gated (ADR-0003): Guests can Bookmark but not
// Clip. Creating a Clip is also what triggers the eager render (ADR-0002), so
// the gate here is what keeps the render pipeline non-anonymous.
export const clipsRouter = router({
  create: memberProcedure("mutation")
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
        .refine(withinMaxDuration, {
          message: tooLongMessage,
          path: ["endSeconds"],
        })
    )
    .mutation(async ({ input, ctx }) => {
      // Per-User cap (ADR-0002). Re-adding an exact-bounds Clip is idempotent
      // and must still succeed at the limit, so only block genuinely new ones.
      const [{ value: clipCount }] = await db
        .select({ value: count() })
        .from(clips)
        .where(eq(clips.userId, ctx.user.id))

      if (clipCount >= CLIP_RENDER_CONFIG.maxClipsPerUser) {
        const existing = await db.query.clips.findFirst({
          where: and(
            eq(clips.userId, ctx.user.id),
            eq(clips.fileId, input.fileId),
            eq(clips.startSeconds, input.startSeconds),
            eq(clips.endSeconds, input.endSeconds)
          ),
        })
        if (existing) {
          return existing
        }
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached the limit of ${CLIP_RENDER_CONFIG.maxClipsPerUser} clips. Delete some to make more.`,
        })
      }

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

      const clip =
        row ??
        (await db.query.clips.findFirst({
          where: and(
            eq(clips.userId, ctx.user.id),
            eq(clips.fileId, input.fileId),
            eq(clips.startSeconds, input.startSeconds),
            eq(clips.endSeconds, input.endSeconds)
          ),
        })) ??
        null

      // Eager render (ADR-0002): enqueue for these bounds. Idempotent and
      // content-keyed, so re-adds and cross-user duplicates collapse.
      if (clip) {
        await ensureClipRender(
          {
            fileId: clip.fileId,
            startSeconds: clip.startSeconds,
            endSeconds: clip.endSeconds,
          },
          ctx.user.id
        )
      }

      return clip
    }),

  // Clip bounds are immutable (ADR-0002) — only the note is editable. Changing a
  // range means creating a new Clip, so there is no render to re-enqueue here.
  update: memberProcedure("mutation")
    .input(
      z.object({
        id: z.number().int().positive(),
        note: z.string().max(2000).nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [row] = await db
        .update(clips)
        .set({ note: input.note })
        .where(and(eq(clips.id, input.id), eq(clips.userId, ctx.user.id)))
        .returning()
      return row ?? null
    }),

  // NOTE: Clips are intentionally NOT deletable (ADR-0002). Allowing delete
  // would let a User churn — delete to free the per-User cap, then create new
  // clips — driving unbounded renders. With no delete, each User can ever
  // trigger at most `maxClipsPerUser` unique renders.

  // Clips of the caller whose render is still in flight. Read once on app load
  // so the render-progress card resumes across reloads/devices (the DB is the
  // source of truth — no client-persisted state). Bounded by the per-user cap.
  activeRenders: memberProcedure("query").query(async ({ ctx }) => {
    const rows = await loadOwnedClipsWithRenders(ctx.user.id)
    return rows
      .filter(
        ({ render }) =>
          render?.status === "pending" || render?.status === "processing"
      )
      .map(({ clip, render }) => ({
        clipId: clip.id,
        fileId: clip.fileId,
        startSeconds: clip.startSeconds,
        endSeconds: clip.endSeconds,
        title: clip.file.title,
        status: render?.status ?? "pending",
      }))
  }),

  // Render lifecycle for the owner's clips, to drive Library UI state.
  renderStatuses: memberProcedure("query")
    .input(z.object({ clipIds: z.array(z.number().int().positive()).max(200) }))
    .query(async ({ input, ctx }) => {
      const rows = await loadOwnedClipsWithRenders(ctx.user.id, input.clipIds)
      return rows.map((r) => ({
        clipId: r.clip.id,
        status: r.render?.status ?? "pending",
        error: r.render?.error ?? null,
      }))
    }),

  // Export / download delivery (ADR-0002): hand back signed URLs for the
  // owner's ready clips, capped at maxExportItems. Missing renders are
  // enqueued so a stale/never-rendered clip self-heals on request.
  getDownloadUrls: memberProcedure("query")
    .input(
      z.object({
        clipIds: z
          .array(z.number().int().positive())
          .max(CLIP_RENDER_CONFIG.maxExportItems),
      })
    )
    .query(async ({ input, ctx }) => {
      const rows = await loadOwnedClipsWithRenders(ctx.user.id, input.clipIds)

      return Promise.all(
        rows.map(async ({ clip, render }) => {
          if (render?.status === "ready" && render.r2Key) {
            const ttl = CLIP_RENDER_CONFIG.signedUrlTtlSeconds
            const filename = clipDownloadName(
              clip.file.title,
              clip.startSeconds,
              clip.endSeconds
            )
            // Two presigns: one inline for the <video>, one attachment-
            // disposition so Download actually saves (cross-origin `download`
            // attr is ignored — see lib/r2.ts).
            const [url, downloadUrl] = await Promise.all([
              getClipDownloadUrl(render.r2Key, ttl),
              getClipDownloadUrl(render.r2Key, ttl, filename),
            ])
            return {
              clipId: clip.id,
              status: "ready" as const,
              url,
              downloadUrl,
            }
          }

          // No render yet (or it failed) — enqueue and report not-ready.
          if (!render || render.status === "failed") {
            await ensureClipRender(
              {
                fileId: clip.fileId,
                startSeconds: clip.startSeconds,
                endSeconds: clip.endSeconds,
              },
              ctx.user.id
            )
          }
          return {
            clipId: clip.id,
            status: (render?.status ?? "pending") as
              | "pending"
              | "processing"
              | "failed",
            url: null,
            downloadUrl: null,
          }
        })
      )
    }),
})

/**
 * Load the caller's clips by id and pair each with its shared render row
 * (joined on the content key — no FK). Clips not owned by the caller are
 * silently dropped.
 */
async function loadOwnedClipsWithRenders(userId: string, clipIds?: number[]) {
  // `clipIds` undefined → all of the caller's clips (capped per user, so
  // bounded); an explicit empty array → nothing.
  if (clipIds && clipIds.length === 0) {
    return []
  }

  const ownedClips = await db.query.clips.findMany({
    where: clipIds
      ? and(eq(clips.userId, userId), inArray(clips.id, clipIds))
      : eq(clips.userId, userId),
    with: { file: { columns: { title: true } } },
  })
  if (ownedClips.length === 0) {
    return []
  }

  const renders = await db
    .select()
    .from(clipRenders)
    .where(
      or(
        ...ownedClips.map((c) =>
          and(
            eq(clipRenders.fileId, c.fileId),
            eq(clipRenders.startSeconds, c.startSeconds),
            eq(clipRenders.endSeconds, c.endSeconds)
          )
        )
      )
    )

  const renderByKey = new Map(
    renders.map((r) => [
      clipRenderObjectKey({
        fileId: r.fileId,
        startSeconds: r.startSeconds,
        endSeconds: r.endSeconds,
      }),
      r,
    ])
  )

  return ownedClips.map((clip) => ({
    clip,
    render:
      renderByKey.get(
        clipRenderObjectKey({
          fileId: clip.fileId,
          startSeconds: clip.startSeconds,
          endSeconds: clip.endSeconds,
        })
      ) ?? null,
  }))
}
