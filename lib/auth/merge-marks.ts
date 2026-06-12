import { and, eq } from "drizzle-orm"
import type { db } from "@/lib/db"
import { bookmarks, clips, collectionMarks, collections } from "@/lib/db/schema"

type Database = typeof db
type MarkType = "bookmark" | "clip"

/**
 * Merge a Guest's marks into a Member on upgrade (ADR-0003).
 *
 * The merge is a union: Bookmarks on the same File collapse, Clips collapse
 * only when their bounds are exactly identical, and Collections transfer as-is.
 * When a mark collapses, the surviving Member mark inherits the Guest mark's
 * Collection memberships. Reassigned (non-colliding) marks keep their row id so
 * their existing `collection_marks` rows stay valid without rewrites.
 *
 * Runs in a single transaction. The caller (the anonymous plugin's
 * `onLinkAccount` hook) deletes the Guest user afterward; by then every mark
 * and Collection has been re-owned, so the cascade removes nothing of value.
 *
 * The helpers are nested closures rather than top-level functions on purpose:
 * naming the transaction's `tx` type explicitly forces TypeScript to expand the
 * full relational-schema transaction type, which is a tsc memory blow-up. Keep
 * `tx` inferred.
 */
export async function mergeGuestMarksIntoMember(
  database: Database,
  guestUserId: string,
  memberUserId: string
): Promise<void> {
  if (guestUserId === memberUserId) {
    return
  }

  await database.transaction(async (tx) => {
    // Move the collapsing mark's Collection memberships onto the surviving
    // mark, skipping any the survivor already has, then drop the old rows.
    const inheritMemberships = async (
      markType: MarkType,
      fromMarkId: number,
      toMarkId: number
    ) => {
      const memberships = await tx
        .select({ collectionId: collectionMarks.collectionId })
        .from(collectionMarks)
        .where(
          and(
            eq(collectionMarks.markType, markType),
            eq(collectionMarks.markId, fromMarkId)
          )
        )

      for (const m of memberships) {
        await tx
          .insert(collectionMarks)
          .values({ collectionId: m.collectionId, markType, markId: toMarkId })
          .onConflictDoNothing()
      }

      await tx
        .delete(collectionMarks)
        .where(
          and(
            eq(collectionMarks.markType, markType),
            eq(collectionMarks.markId, fromMarkId)
          )
        )
    }

    // Bookmarks — collapse on same File.
    const guestBookmarks = await tx
      .select({ id: bookmarks.id, fileId: bookmarks.fileId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, guestUserId))
    if (guestBookmarks.length > 0) {
      const memberBookmarks = await tx
        .select({ id: bookmarks.id, fileId: bookmarks.fileId })
        .from(bookmarks)
        .where(eq(bookmarks.userId, memberUserId))
      const survivorByFile = new Map(
        memberBookmarks.map((r) => [r.fileId, r.id])
      )

      for (const guest of guestBookmarks) {
        const survivor = survivorByFile.get(guest.fileId)
        if (survivor === undefined) {
          await tx
            .update(bookmarks)
            .set({ userId: memberUserId })
            .where(eq(bookmarks.id, guest.id))
          survivorByFile.set(guest.fileId, guest.id)
        } else {
          await inheritMemberships("bookmark", guest.id, survivor)
          await tx.delete(bookmarks).where(eq(bookmarks.id, guest.id))
        }
      }
    }

    // Clips — collapse only on exactly identical bounds.
    const boundsKey = (c: {
      fileId: number
      startSeconds: number
      endSeconds: number
    }) => `${c.fileId}:${c.startSeconds}:${c.endSeconds}`
    const guestClips = await tx
      .select({
        id: clips.id,
        fileId: clips.fileId,
        startSeconds: clips.startSeconds,
        endSeconds: clips.endSeconds,
      })
      .from(clips)
      .where(eq(clips.userId, guestUserId))
    if (guestClips.length > 0) {
      const memberClips = await tx
        .select({
          id: clips.id,
          fileId: clips.fileId,
          startSeconds: clips.startSeconds,
          endSeconds: clips.endSeconds,
        })
        .from(clips)
        .where(eq(clips.userId, memberUserId))
      const survivorByBounds = new Map(
        memberClips.map((r) => [boundsKey(r), r.id])
      )

      for (const guest of guestClips) {
        const survivor = survivorByBounds.get(boundsKey(guest))
        if (survivor === undefined) {
          await tx
            .update(clips)
            .set({ userId: memberUserId })
            .where(eq(clips.id, guest.id))
          survivorByBounds.set(boundsKey(guest), guest.id)
        } else {
          await inheritMemberships("clip", guest.id, survivor)
          await tx.delete(clips).where(eq(clips.id, guest.id))
        }
      }
    }

    // Collections transfer wholesale — names need not be unique per User, so
    // there is nothing to collapse. Their membership rows were already
    // re-pointed above wherever a mark collapsed.
    await tx
      .update(collections)
      .set({ userId: memberUserId })
      .where(eq(collections.userId, guestUserId))
  })
}
