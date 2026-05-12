import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import {
  GIF_DURATION_S,
  GIF_FPS,
  GIF_WIDTH,
  SOURCE_DIR,
  THUMB_QUALITY,
  THUMB_WIDTH,
  VIDEO_PREVIEW_DIR,
} from "./config"
import { info, progress, summary } from "./logger"
import type { PreviewStats } from "./types"
import { fileExists, requireBinary } from "./utils"

const MP4_EXT_RE = /\.mp4$/i

function getVideoDuration(filePath: string): number {
  try {
    const output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        filePath,
      ],
      { encoding: "utf-8" }
    )
    return Number.parseFloat(output.trim()) || 0
  } catch {
    return 0
  }
}

function generateThumbnail(inputPath: string, outputPath: string): boolean {
  try {
    const duration = getVideoDuration(inputPath)
    const seekTo = Math.min(2, duration * 0.1)

    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(seekTo),
        "-i",
        inputPath,
        "-vframes",
        "1",
        "-q:v",
        String(THUMB_QUALITY),
        "-vf",
        `scale=${THUMB_WIDTH}:-2`,
        outputPath,
      ],
      { stdio: "pipe" }
    )

    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : String(err)
    console.error(`  Thumbnail failed: ${msg}`)
    return false
  }
}

function generateGif(inputPath: string, outputPath: string): boolean {
  const palettePath = outputPath.replace(".gif", "_palette.png")

  try {
    const duration = getVideoDuration(inputPath)
    if (duration <= 0) {
      console.error("  Could not determine video duration")
      return false
    }

    // pass 1: generate palette from first N seconds
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-t",
        String(GIF_DURATION_S),
        "-i",
        inputPath,
        "-vf",
        `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos,palettegen=stats_mode=diff`,
        palettePath,
      ],
      { stdio: "pipe" }
    )

    // pass 2: render GIF using palette
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-t",
        String(GIF_DURATION_S),
        "-i",
        inputPath,
        "-i",
        palettePath,
        "-lavfi",
        `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
        "-loop",
        "0",
        outputPath,
      ],
      { stdio: "pipe" }
    )

    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err)
    console.error(`  GIF failed: ${msg}`)
    return false
  } finally {
    // clean up palette file
    try {
      unlinkSync(palettePath)
    } catch {
      // ignore - may not exist if pass 1 failed
    }
  }
}

export function main() {
  info("Step 7: Generating video previews\n")

  requireBinary("ffmpeg", "brew install ffmpeg")
  requireBinary("ffprobe", "brew install ffmpeg")

  // scan for local MP4s
  const mp4Files = readdirSync(SOURCE_DIR).filter((f) =>
    f.toLowerCase().endsWith(".mp4")
  )
  info(`Found ${mp4Files.length} MP4 files\n`)

  if (mp4Files.length === 0) {
    summary(["No videos to process"])
    return
  }

  mkdirSync(VIDEO_PREVIEW_DIR, { recursive: true })

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
    const thumbPath = join(VIDEO_PREVIEW_DIR, `${stem}_thumb.jpg`)
    const gifPath = join(VIDEO_PREVIEW_DIR, `${stem}_preview.gif`)

    // skip if both already exist
    if (fileExists(thumbPath) && fileExists(gifPath)) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      continue
    }

    let thumbOk = fileExists(thumbPath)
    let gifOk = fileExists(gifPath)

    // generate thumbnail if missing
    if (thumbOk) {
      process.stdout.write(
        `[${i + 1}/${stats.total}] ${filename} - thumb exists`
      )
    } else {
      process.stdout.write(
        `[${i + 1}/${stats.total}] ${filename} - thumbnail...`
      )
      thumbOk = generateThumbnail(inputPath, thumbPath)
      if (thumbOk) {
        const kb = (statSync(thumbPath).size / 1024).toFixed(0)
        process.stdout.write(` done (${kb} KB)`)
      } else {
        process.stdout.write(" failed")
      }
    }

    // generate GIF if missing
    if (gifOk) {
      process.stdout.write(" | GIF exists\n")
    } else {
      process.stdout.write(" | GIF...")
      gifOk = generateGif(inputPath, gifPath)
      if (gifOk) {
        const kb = (statSync(gifPath).size / 1024).toFixed(0)
        process.stdout.write(` done (${kb} KB)\n`)
      } else {
        process.stdout.write(" failed\n")
      }
    }

    if (thumbOk && gifOk) {
      stats.generated++
    } else {
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Output: ${VIDEO_PREVIEW_DIR}`,
  ])
}

if (process.argv[1]?.includes("07-generate-video-previews")) {
  try {
    main()
  } catch (err) {
    console.error("Fatal:", err)
    process.exit(1)
  }
}
