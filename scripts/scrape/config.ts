import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Release resolution (CLI --release flag > RELEASE env var > default)
// ---------------------------------------------------------------------------
function resolveRelease(): string {
  const idx = process.argv.indexOf("--release")
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  if (process.env.RELEASE) {
    return process.env.RELEASE
  }
  return "release-1"
}
export const RELEASE = resolveRelease()

// ---------------------------------------------------------------------------
// Paths (relative to project root - two levels up from scripts/scrape/)
// ---------------------------------------------------------------------------
export const PROJECT_ROOT = join(__dirname, "..", "..")
export const RECORDS_PATH = join(PROJECT_ROOT, `ufo-records-${RELEASE}.json`)
export const CSV_PATH = join(PROJECT_ROOT, `ufo-records-${RELEASE}.csv`)
export const OUT_DIR = join(PROJECT_ROOT, "ufo-files", RELEASE)
export const SOURCE_DIR = join(OUT_DIR, "source")
export const URLS_PATH = join(PROJECT_ROOT, `ufo-download-urls-${RELEASE}.txt`)

// ---------------------------------------------------------------------------
// Remote URLs
// ---------------------------------------------------------------------------
export const CSV_URL =
  "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-data.csv"
export const WAR_GOV_UFO = "https://www.war.gov/UFO/"

// ---------------------------------------------------------------------------
// Release publication dates, exactly as they appear in the CSV "Release Date"
// column. The CSV is a single combined file containing every release; records
// are partitioned by this date. Add the new date here when a release drops.
// ---------------------------------------------------------------------------
export const RELEASE_DATES: Record<string, string> = {
  "release-1": "5/8/26",
  "release-2": "5/22/26",
  "release-3": "6/12/26",
  "release-4": "7/10/26",
  "release-5": "8/7/26",
}

// ---------------------------------------------------------------------------
// DVIDS API
// ---------------------------------------------------------------------------
export const DVIDS_API_BASE = "https://api.dvidshub.net/asset"
// Must come from the environment — never hardcode the key (it would live in git
// history). The DVIDS download step validates it's present before use.
export const DVIDS_API_KEY = process.env.DVIDS_API_KEY ?? ""

// ---------------------------------------------------------------------------
// Batch / throttle settings
// ---------------------------------------------------------------------------
export const DOC_BATCH_SIZE = 5
export const DOC_BATCH_PAUSE_MS = 500
export const VIDEO_BATCH_SIZE = 3
export const VIDEO_BATCH_PAUSE_MS = 500
export const DOWNLOAD_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Retry settings
// ---------------------------------------------------------------------------
export const MAX_RETRIES = 3
export const RETRY_BASE_DELAY_MS = 1000

// ---------------------------------------------------------------------------
// Preview generation settings
// ---------------------------------------------------------------------------
export const PDF_PREVIEW_DIR = join(OUT_DIR, "pdf-pages")
export const TRANSCRIPT_DIR = join(OUT_DIR, "transcripts")
export const VIDEO_PREVIEW_DIR = join(OUT_DIR, "previews")

// PDF preview (pdftoppm)
export const PDF_DPI = 200
export const PDF_SCALE_TO = 1200 // max width in pixels

// Video preview (ffmpeg)
export const THUMB_WIDTH = 400
export const THUMB_QUALITY = 3 // ffmpeg -q:v (1=best, 31=worst)
export const GIF_WIDTH = 320
export const GIF_DURATION_S = 2.5
export const GIF_FPS = 10

// Card thumbnail generation (sharp)
export const CARD_THUMB_DIR = join(OUT_DIR, "card-thumbs")
export const CARD_THUMB_WIDTH = 300
export const CARD_THUMB_QUALITY = 80

// Video transcoding (ffmpeg)
export const VIDEO_STREAM_DIR = join(OUT_DIR, "video-stream")
export const STREAM_VIDEO_HEIGHT = 720
export const STREAM_VIDEO_CRF = 20
export const STREAM_VIDEO_PRESET = "slow"
export const STREAM_AUDIO_BITRATE = "128k"

// HLS transcoding
export const HLS_SEGMENT_DURATION = 4
export const HLS_RENDITIONS = [
  { height: 360, crf: 23, bitrate: "600k", audioBitrate: "96k" },
  { height: 720, crf: 20, bitrate: "2000k", audioBitrate: "128k" },
  { height: 1080, crf: 18, bitrate: "4000k", audioBitrate: "128k" },
] as const

// ---------------------------------------------------------------------------
// R2 upload settings
// ---------------------------------------------------------------------------
export const UPLOAD_PART_SIZE = 10 * 1024 * 1024 // 10MB
export const UPLOAD_QUEUE_SIZE = 4
