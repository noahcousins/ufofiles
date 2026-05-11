import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  SOURCE_DIR,
  STREAM_AUDIO_BITRATE,
  STREAM_VIDEO_CRF,
  STREAM_VIDEO_HEIGHT,
  STREAM_VIDEO_PRESET,
  VIDEO_STREAM_DIR,
} from "./config"
import { info, progress, summary } from "./logger"
import type { PreviewStats } from "./types"
import { fileExists, requireBinary } from "./utils"

const MP4_EXT_RE = /\.mp4$/i

export function main() {
  info("Step 9: Transcoding videos to 720p streaming versions\n")

  requireBinary("ffmpeg", "brew install ffmpeg")

  const mp4Files = readdirSync(SOURCE_DIR).filter((f) =>
    f.toLowerCase().endsWith(".mp4")
  )
  info(`Found ${mp4Files.length} MP4 files\n`)

  if (mp4Files.length === 0) {
    summary(["No videos to transcode"])
    return
  }

  mkdirSync(VIDEO_STREAM_DIR, { recursive: true })

  const stats: PreviewStats = {
    generated: 0,
    skipped: 0,
    failed: 0,
    total: mp4Files.length,
  }

  for (let i = 0; i < mp4Files.length; i++) {
    const filename = mp4Files[i]
    const stem = filename.replace(MP4_EXT_RE, "")
    const inputPath = join(SOURCE_DIR, filename)
    const outputPath = join(VIDEO_STREAM_DIR, `${stem}_720p.mp4`)

    // skip if already transcoded
    if (fileExists(outputPath)) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      continue
    }

    try {
      const inputSize = statSync(inputPath).size
      const inputMb = (inputSize / 1024 / 1024).toFixed(1)
      process.stdout.write(
        `[${i + 1}/${stats.total}] ${filename} (${inputMb} MB) — transcoding...`
      )

      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-i",
          inputPath,
          "-vf",
          `scale=-2:${STREAM_VIDEO_HEIGHT}`,
          "-c:v",
          "libx264",
          "-preset",
          STREAM_VIDEO_PRESET,
          "-crf",
          String(STREAM_VIDEO_CRF),
          "-c:a",
          "aac",
          "-b:a",
          STREAM_AUDIO_BITRATE,
          "-movflags",
          "+faststart",
          outputPath,
        ],
        { stdio: "pipe" }
      )

      const outputSize = statSync(outputPath).size
      const outputMb = (outputSize / 1024 / 1024).toFixed(1)
      const ratio = Math.round((1 - outputSize / inputSize) * 100)
      process.stdout.write(` done (${outputMb} MB, ${ratio}% smaller)\n`)
      stats.generated++
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", filename, msg)
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.generated} transcoded, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Output: ${VIDEO_STREAM_DIR}`,
  ])
}

if (process.argv[1]?.includes("09-transcode-videos")) {
  try {
    main()
  } catch (err) {
    console.error("Fatal:", err)
    process.exit(1)
  }
}
