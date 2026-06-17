import { tasks } from "@trigger.dev/sdk/v3"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { clipRenders } from "@/lib/db/schema"
import type { renderClipTask } from "@/trigger/render-clip"

interface Bounds {
  endSeconds: number
  fileId: number
  startSeconds: number
}

/**
 * Ensure a render exists for these exact bounds and enqueue it if it's new.
 *
 * The `onConflictDoNothing` on the content-key index is the whole dedupe story:
 * a fresh insert means nobody has ever asked for these bounds → enqueue once; a
 * conflict means it's already rendered or in-flight → no-op. Safe to call on
 * every clip create/edit.
 *
 * Enqueue failures (e.g. trigger.dev not yet configured) are swallowed: the
 * `clip_renders` row stays `pending` so the clip create still succeeds and the
 * render can be backfilled later. Mirrors how Redis degrades gracefully.
 */
export async function ensureClipRender(
  bounds: Bounds,
  triggeredByUserId: string
): Promise<void> {
  const [row] = await db
    .insert(clipRenders)
    .values(bounds)
    .onConflictDoNothing({
      target: [
        clipRenders.fileId,
        clipRenders.startSeconds,
        clipRenders.endSeconds,
      ],
    })
    .returning({ id: clipRenders.id })

  // Conflict → already rendered or queued by someone else. Nothing to do.
  if (!row) {
    return
  }

  try {
    const handle = await tasks.trigger<typeof renderClipTask>(
      "render-clip",
      { clipRenderId: row.id, ...bounds },
      {
        // Idempotency guard on top of the DB unique index, in case two inserts
        // race past onConflictDoNothing in separate connections.
        idempotencyKey: `clip-render:${bounds.fileId}:${bounds.startSeconds}:${bounds.endSeconds}`,
        // Per-User fairness: caps how many renders one User can have running.
        concurrencyKey: triggeredByUserId,
      }
    )
    await db
      .update(clipRenders)
      .set({ triggerRunId: handle.id, updatedAt: new Date() })
      .where(eq(clipRenders.id, row.id))
  } catch (err) {
    // Leave the row pending for backfill; never block the clip write.
    console.error("[clips] failed to enqueue render", row.id, err)
  }
}
