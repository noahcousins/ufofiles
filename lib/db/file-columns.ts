import { files } from "@/lib/db/schema"

/**
 * The public-safe column projection of a File. Use this for ANY endpoint that
 * returns Files to the client, so a bare `select()` can't leak internal-only
 * columns.
 *
 * Deliberately excludes:
 * - `textContent` — the full OCR dump, too large for responses and not needed
 *   client-side (search runs server-side against the GIN index).
 * - `extractionStatus` / `extractionMethod` / `extractionError` — internal
 *   pipeline state; `extractionError` can carry internal error strings.
 *
 * Includes `r2Key` / `transcriptR2Key`: those are NOT secret — the client
 * builds Worker URLs from them (see `lib/file-url.ts`).
 */
export const publicFileColumns = {
  id: files.id,
  releaseId: files.releaseId,
  title: files.title,
  agency: files.agency,
  releaseDate: files.releaseDate,
  incidentDate: files.incidentDate,
  incidentYear: files.incidentYear,
  incidentLocation: files.incidentLocation,
  type: files.type,
  r2Key: files.r2Key,
  fileSize: files.fileSize,
  mimeType: files.mimeType,
  documentUrl: files.documentUrl,
  thumbnailUrl: files.thumbnailUrl,
  videoId: files.videoId,
  description: files.description,
  transcriptR2Key: files.transcriptR2Key,
  redacted: files.redacted,
  createdAt: files.createdAt,
} as const
