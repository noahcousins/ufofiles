import { tasks } from "@trigger.dev/sdk/v3"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { clipRenders } from "@/lib/db/schema"
import type { renderClipTask } from "@/trigger/render-clip"

interface Bounds {
  endSeconds: number
  fileId: number
  startSeconds: number
}

/**
 * Enqueue a render.dev task for `renderId` and record the run id. On a retry we
 * deliberately omit the idempotency key: the content-key idempotency guard is
 * only there to collapse racing *fresh* inserts — a retry is an explicit
 * decision to start a new run, and reusing the key would just hand back the
 * dead/never-started run. The per-User concurrency key still bounds abuse.
 */
async function triggerRender(
  renderId: number,
  bounds: Bounds,
  triggeredByUserId: string,
  { idempotent }: { idempotent: boolean }
): Promise<void> {
  try {
    const handle = await tasks.trigger<typeof renderClipTask>(
      "render-clip",
      { clipRenderId: renderId, ...bounds },
      {
        ...(idempotent
          ? {
              idempotencyKey: `clip-render:${bounds.fileId}:${bounds.startSeconds}:${bounds.endSeconds}`,
            }
          : {}),
        // Per-User fairness: caps how many renders one User can have running.
        concurrencyKey: triggeredByUserId,
      }
    )
    await db
      .update(clipRenders)
      .set({
        triggerRunId: handle.id,
        status: "pending",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(clipRenders.id, renderId))
  } catch (err) {
    // Leave the row pending for a later retry; never block the clip write.
    console.error("[clips] failed to enqueue render", renderId, err)
  }
}

/**
 * Ensure a render exists for these exact bounds and that it has a live run.
 *
 * - Fresh insert (nobody has asked for these bounds) → enqueue once, using the
 *   content-key idempotency guard against racing inserts.
 * - Existing row with no live run → re-enqueue (the genuine "backfill"): a
 *   `failed` render, or a `pending` row whose enqueue never landed
 *   (`triggerRunId` is null, e.g. trigger.dev was unconfigured or threw).
 * - Existing row that's already `ready`/`processing`, or `pending` with a run
 *   in flight → no-op.
 *
 * Safe (and cheap) to call on every clip create and on download/export reads,
 * which is what makes `getDownloadUrls`/`activeRenders` self-heal.
 */
export async function ensureClipRender(
  bounds: Bounds,
  triggeredByUserId: string
): Promise<void> {
  const [inserted] = await db
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

  if (inserted) {
    await triggerRender(inserted.id, bounds, triggeredByUserId, {
      idempotent: true,
    })
    return
  }

  // Conflict → a row already exists. Re-enqueue only if it has no live run.
  const [existing] = await db
    .select({
      id: clipRenders.id,
      status: clipRenders.status,
      triggerRunId: clipRenders.triggerRunId,
    })
    .from(clipRenders)
    .where(
      and(
        eq(clipRenders.fileId, bounds.fileId),
        eq(clipRenders.startSeconds, bounds.startSeconds),
        eq(clipRenders.endSeconds, bounds.endSeconds)
      )
    )
    .limit(1)

  if (!existing) {
    return
  }

  const hasNoLiveRun =
    existing.status === "failed" ||
    (existing.status === "pending" && existing.triggerRunId === null)

  if (hasNoLiveRun) {
    await triggerRender(existing.id, bounds, triggeredByUserId, {
      idempotent: false,
    })
  }
}
