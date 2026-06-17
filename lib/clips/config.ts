// Tunables for clip rendering / delivery (ADR-0002). Expected to be tuned with
// real usage; centralised here so the queue + validation + delivery all agree.

export const CLIP_RENDER_CONFIG = {
  /** Hard cap on a single clip's duration. Enforced at create validation so an
   * over-long clip never reaches the render queue. Bounds per-render compute,
   * output size, and R2 storage (ADR-0002). */
  maxClipSeconds: 60,

  /** Max clips handed back in one export/download batch. */
  maxExportItems: 50,

  /** Hard cap on how many Clips a single User can own. Bounds total render +
   * storage exposure per account (ADR-0002). */
  maxClipsPerUser: 50,

  /** Global ceiling on simultaneous ffmpeg render jobs (trigger.dev queue). */
  queueConcurrencyLimit: 5,

  /** Per-User in-flight render cap (trigger.dev concurrency key), so one User
   * spamming clip-creates can't monopolise the global pool. */
  perUserConcurrencyLimit: 2,

  /** Presigned-URL lifetime for delivery. R2 caps this at 7 days. */
  signedUrlTtlSeconds: 7 * 24 * 60 * 60, // 604800

  /** Poster + hover-GIF generated per clip (mirrors the scrape pipeline). These
   * are previews, not the deliverable, so they're public assets. The GIF is the
   * only non-trivial extra compute on the render job — drop `gif*` to skip it. */
  preview: {
    thumbWidth: 480,
    thumbQuality: 4, // ffmpeg -q:v (2 best … 5 worst)
    gifWidth: 360,
    gifFps: 12,
    gifSeconds: 3, // sample the first N seconds of the clip
  },
} as const

interface ClipBounds {
  endSeconds: number
  fileId: number
  startSeconds: number
}

/** Content-keyed R2 object key for a rendered clip (private clips bucket).
 * Identical bounds on the same file always produce the same key — the cache. */
export function clipRenderObjectKey(opts: ClipBounds): string {
  return `clips/${opts.fileId}/${opts.startSeconds}-${opts.endSeconds}.mp4`
}

/** Content-keyed key for a clip's poster (jpg) or hover preview (gif). Lives in
 * the public `assets/` bucket so the Library grid can show it with a stable,
 * worker-served URL (no presigning) — see ADR-0002. */
export function clipPreviewKey(opts: ClipBounds, ext: "jpg" | "gif"): string {
  return `assets/clips/${opts.fileId}/${opts.startSeconds}-${opts.endSeconds}.${ext}`
}

/** Human-friendly download filename for a clip — used as the attachment name in
 * the presigned URL's Content-Disposition. */
export function clipDownloadName(
  title: string,
  startSeconds: number,
  endSeconds: number
): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clip"
  return `${slug}_${startSeconds}-${endSeconds}.mp4`
}
