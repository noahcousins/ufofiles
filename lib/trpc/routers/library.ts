import { desc, eq } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { bookmarks, clips, files } from "@/lib/db/schema"
import { router } from "../init"
import { protectedProcedure } from "../procedures"

// Mirrors the `FileItem` shape the file browser's FileCard renders, so the
// Library can reuse the exact same card component.
const fileColumns = {
  id: files.id,
  title: files.title,
  agency: files.agency,
  description: files.description,
  documentUrl: files.documentUrl,
  fileSize: files.fileSize,
  incidentDate: files.incidentDate,
  incidentLocation: files.incidentLocation,
  mimeType: files.mimeType,
  r2Key: files.r2Key,
  releaseDate: files.releaseDate,
  thumbnailUrl: files.thumbnailUrl,
  transcriptR2Key: files.transcriptR2Key,
}

export const libraryRouter = router({
  // The User's complete Library — every Bookmark and Clip, with enough of the
  // referenced File to render a card. Collections are fetched separately.
  list: protectedProcedure("query")
    .input(z.void())
    .query(async ({ ctx }) => {
      const [bookmarkRows, clipRows] = await Promise.all([
        db
          .select({
            id: bookmarks.id,
            note: bookmarks.note,
            createdAt: bookmarks.createdAt,
            file: fileColumns,
          })
          .from(bookmarks)
          .innerJoin(files, eq(files.id, bookmarks.fileId))
          .where(eq(bookmarks.userId, ctx.user.id))
          .orderBy(desc(bookmarks.createdAt)),
        db
          .select({
            id: clips.id,
            startSeconds: clips.startSeconds,
            endSeconds: clips.endSeconds,
            note: clips.note,
            createdAt: clips.createdAt,
            file: fileColumns,
          })
          .from(clips)
          .innerJoin(files, eq(files.id, clips.fileId))
          .where(eq(clips.userId, ctx.user.id))
          .orderBy(desc(clips.createdAt)),
      ])

      return { bookmarks: bookmarkRows, clips: clipRows }
    }),
})
