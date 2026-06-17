import { execFile } from "node:child_process"
import { readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { logger, task } from "@trigger.dev/sdk/v3"
import { eq } from "drizzle-orm"
import {
  CLIP_RENDER_CONFIG,
  clipPreviewKey,
  clipRenderObjectKey,
} from "@/lib/clips/config"
import { db } from "@/lib/db"
import { clipRenders, files } from "@/lib/db/schema"
import { getStreamVideoKey } from "@/lib/file-url"
import { getSourceDownloadUrl, putClipRender, putFile } from "@/lib/r2"

// Hard ceiling for the ffmpeg process itself (cost guardrail) — kept under the
// task maxDuration so a hung encode is killed promptly, not billed to the cap.
const FFMPEG_TIMEOUT_MS = 140_000
const FF_OPTS = { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }

interface Bounds {
  endSeconds: number
  fileId: number
  startSeconds: number
}

/**
 * Generate a poster (jpg) + hover-preview (gif) from the already-rendered local
 * clip, like the scrape pipeline does for full videos. Best-effort: the mp4 is
 * the deliverable, so a preview failure is logged, not fatal. Stored public in
 * the assets bucket for stable, presign-free display in the Library grid.
 */
async function generateClipPreviews(
  clipPath: string,
  bounds: Bounds,
  clipRenderId: number
): Promise<void> {
  const { thumbWidth, thumbQuality, gifWidth, gifFps, gifSeconds } =
    CLIP_RENDER_CONFIG.preview
  const dur = bounds.endSeconds - bounds.startSeconds
  const thumbPath = join(tmpdir(), `clip-${clipRenderId}-thumb.jpg`)
  const gifPath = join(tmpdir(), `clip-${clipRenderId}.gif`)
  const palettePath = join(tmpdir(), `clip-${clipRenderId}-palette.png`)

  try {
    // Poster: a representative frame ~10% into the clip (avoids a black frame 0).
    await run(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        String(Math.min(1, dur * 0.1)),
        "-i",
        clipPath,
        "-vframes",
        "1",
        "-q:v",
        String(thumbQuality),
        "-vf",
        `scale=${thumbWidth}:-2`,
        thumbPath,
      ],
      FF_OPTS
    )
    await putFile(
      clipPreviewKey(bounds, "jpg"),
      await readFile(thumbPath),
      "image/jpeg"
    )

    // GIF: 2-pass palettegen → paletteuse (matches the pipeline's quality path).
    await run(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-t",
        String(gifSeconds),
        "-i",
        clipPath,
        "-vf",
        `fps=${gifFps},scale=${gifWidth}:-2:flags=lanczos,palettegen=stats_mode=diff`,
        palettePath,
      ],
      FF_OPTS
    )
    await run(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-t",
        String(gifSeconds),
        "-i",
        clipPath,
        "-i",
        palettePath,
        "-lavfi",
        `fps=${gifFps},scale=${gifWidth}:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
        "-loop",
        "0",
        gifPath,
      ],
      FF_OPTS
    )
    await putFile(
      clipPreviewKey(bounds, "gif"),
      await readFile(gifPath),
      "image/gif"
    )
  } catch (err) {
    logger.warn("clip preview generation failed (non-fatal)", {
      clipRenderId,
      err: String(err),
    })
  } finally {
    await Promise.all([
      rm(thumbPath, { force: true }),
      rm(gifPath, { force: true }),
      rm(palettePath, { force: true }),
    ])
  }
}

const run = promisify(execFile)

interface Payload {
  clipRenderId: number
  endSeconds: number
  fileId: number
  startSeconds: number
}

export const renderClipTask = task({
  id: "render-clip",
  // Smallest machine that comfortably re-encodes a ≤60s 720p clip — clip work
  // is light, and the per-second rate is what trigger.dev bills (ADR-0002).
  machine: "small-2x",
  // Global ceiling on simultaneous ffmpeg jobs. Per-User fairness is layered on
  // via the concurrencyKey passed at trigger time (see lib/clips/render.ts).
  queue: { concurrencyLimit: CLIP_RENDER_CONFIG.queueConcurrencyLimit },
  run: async (payload: Payload) => {
    const { clipRenderId, fileId, startSeconds, endSeconds } = payload

    const render = await db.query.clipRenders.findFirst({
      where: eq(clipRenders.id, clipRenderId),
    })
    if (!render) {
      throw new Error(`clip_render ${clipRenderId} not found`)
    }
    if (render.status === "ready" && render.r2Key) {
      logger.info("clip already rendered, skipping", { clipRenderId })
      return { r2Key: render.r2Key, cached: true }
    }

    await db
      .update(clipRenders)
      .set({ status: "processing", error: null, updatedAt: new Date() })
      .where(eq(clipRenders.id, clipRenderId))

    try {
      const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
      })
      if (!file?.r2Key) {
        throw new Error(`file ${fileId} has no r2Key`)
      }

      // Clip from the 720p rendition, never the (possibly 4K/multi-GB) original
      // — bounds input size, output size, and compute regardless of the source
      // (ADR-0002). It's also faststart, so the HTTP range-seek is quick.
      const sourceUrl = await getSourceDownloadUrl(
        getStreamVideoKey(file.r2Key),
        3600
      )
      const duration = endSeconds - startSeconds
      const outPath = join(tmpdir(), `clip-${clipRenderId}.mp4`)

      // Re-encode (not stream-copy) so the clip starts on the EXACT frame the
      // user selected, not the nearest keyframe (which can be ~10s off). `-ss`
      // before `-i` is both a fast seek and frame-accurate in modern ffmpeg.
      // To trade precision for near-zero cost, swap these codec args for
      // ["-c", "copy"]. `-loglevel error` keeps stderr small for execFile.
      await run(
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-ss",
          String(startSeconds),
          "-i",
          sourceUrl,
          "-t",
          String(duration),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          outPath,
        ],
        { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }
      )

      const objectKey = clipRenderObjectKey({
        fileId,
        startSeconds,
        endSeconds,
      })
      const buffer = await readFile(outPath)
      await putClipRender(objectKey, buffer)

      // Poster + hover GIF from the local clip — best-effort, before cleanup.
      await generateClipPreviews(
        outPath,
        { fileId, startSeconds, endSeconds },
        clipRenderId
      )
      await rm(outPath, { force: true })

      await db
        .update(clipRenders)
        .set({ status: "ready", r2Key: objectKey, updatedAt: new Date() })
        .where(eq(clipRenders.id, clipRenderId))

      logger.info("clip rendered", { clipRenderId, objectKey })
      return { r2Key: objectKey, cached: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await db
        .update(clipRenders)
        .set({ status: "failed", error: message, updatedAt: new Date() })
        .where(eq(clipRenders.id, clipRenderId))
      throw err
    }
  },
})
