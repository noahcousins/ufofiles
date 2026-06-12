import { sourceToAssets } from "./r2-paths"

const FILE_EXT_RE = /\.[^.]+$/

export function getFileUrl(r2Key: string): string {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
  if (!workerUrl) {
    throw new Error(
      "NEXT_PUBLIC_WORKER_URL is not set. File serving requires the Cloudflare Worker."
    )
  }
  const encoded = r2Key.split("/").map(encodeURIComponent).join("/")
  return `${workerUrl}/${encoded}`
}

/**
 * Mark a Worker file URL for download. The browser ignores the `download`
 * attribute on cross-origin links, so we ask the Worker to send
 * `Content-Disposition: attachment` via this query param instead.
 */
export function withDownloadParam(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`
}

function assetParts(r2Key: string): { prefix: string; stem: string } {
  const parts = sourceToAssets(r2Key).split("/")
  const filename = parts.pop() ?? ""
  const stem = filename.replace(FILE_EXT_RE, "")
  return { prefix: parts.join("/"), stem }
}

export function getStreamingVideoUrl(r2Key: string): string {
  const { prefix, stem } = assetParts(r2Key)
  return getFileUrl(`${prefix}/video-stream/${stem}_720p.mp4`)
}

export function getHlsPlaylistUrl(r2Key: string): string {
  const { prefix, stem } = assetParts(r2Key)
  return getFileUrl(`${prefix}/video-stream/${stem}/master.m3u8`)
}

export function getVideoThumbUrl(r2Key: string): string {
  const { prefix, stem } = assetParts(r2Key)
  return getFileUrl(`${prefix}/video-thumbs/${stem}_thumb.jpg`)
}

export function getVideoGifUrl(r2Key: string): string {
  const { prefix, stem } = assetParts(r2Key)
  return getFileUrl(`${prefix}/video-previews/${stem}_preview.gif`)
}

const CARD_THUMB_VERSION = 3

export function getCardThumbUrl(r2Key: string): string {
  const parts = sourceToAssets(r2Key).split("/")
  const filename = parts.pop() ?? ""
  const prefix = parts.join("/")
  const lastDot = filename.lastIndexOf(".")
  const stem = lastDot >= 0 ? filename.slice(0, lastDot) : filename
  const ext = lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : ""
  const thumbName = ext ? `${stem}_${ext}_card.webp` : `${stem}_card.webp`
  return `${getFileUrl(`${prefix}/card-thumbs/${thumbName}`)}?v=${CARD_THUMB_VERSION}`
}

export function getPdfPageUrl(r2Key: string, page: number): string {
  const { prefix, stem } = assetParts(r2Key)
  const padded = String(page).padStart(3, "0")
  return getFileUrl(`${prefix}/pdf-pages/${stem}/page-${padded}.jpg`)
}

export function getFirstPdfPageUrl(r2Key: string): string {
  return getPdfPageUrl(r2Key, 1)
}
