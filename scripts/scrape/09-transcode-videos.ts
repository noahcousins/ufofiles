import { execFileSync, execSync } from "node:child_process"
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  HLS_RENDITIONS,
  HLS_SEGMENT_DURATION,
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

function probeHeight(inputPath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${inputPath}"`,
      { encoding: "utf-8" }
    )
    return Number.parseInt(out.trim(), 10) || 9999
  } catch {
    return 9999
  }
}

function generateMasterPlaylist(
  hlsDir: string,
  renditions: { height: number; bitrate: string }[]
) {
  const lines = ["#EXTM3U"]
  for (const r of renditions) {
    const bw = Number.parseInt(r.bitrate, 10) * 1000
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${Math.round((r.height * 16) / 9)}x${r.height},CODECS="avc1.640028,mp4a.40.2"`
    )
    lines.push(`${r.height}p/playlist.m3u8`)
  }
  writeFileSync(join(hlsDir, "master.m3u8"), lines.join("\n") + "\n")
}

export function main() {
  info("Step 9: Transcoding videos to 720p MP4 + HLS (ABR)\n")

  requireBinary("ffmpeg", "brew install ffmpeg")
  requireBinary("ffprobe", "brew install ffmpeg")

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
    const mp4OutputPath = join(VIDEO_STREAM_DIR, `${stem}_720p.mp4`)
    const hlsDir = join(VIDEO_STREAM_DIR, stem)

    const masterExists = fileExists(join(hlsDir, "master.m3u8"))
    const mp4Exists = fileExists(mp4OutputPath)

    if (masterExists && mp4Exists) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      continue
    }

    try {
      const inputSize = statSync(inputPath).size
      const inputMb = (inputSize / 1024 / 1024).toFixed(1)
      const sourceHeight = probeHeight(inputPath)

      // --- 720p MP4 (for downloads) ---
      if (!mp4Exists) {
        process.stdout.write(
          `[${i + 1}/${stats.total}] ${filename} (${inputMb} MB) - MP4...`
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
            mp4OutputPath,
          ],
          { stdio: "pipe" }
        )

        const outputSize = statSync(mp4OutputPath).size
        const outputMb = (outputSize / 1024 / 1024).toFixed(1)
        const ratio = Math.round((1 - outputSize / inputSize) * 100)
        process.stdout.write(` ${outputMb} MB (${ratio}% smaller) `)
      }

      // --- HLS (ABR) ---
      process.stdout.write(
        mp4Exists ? `[${i + 1}/${stats.total}] ${filename} - HLS...` : "HLS..."
      )

      mkdirSync(hlsDir, { recursive: true })

      const applicableRenditions = HLS_RENDITIONS.filter(
        (r) => r.height <= sourceHeight
      )
      if (applicableRenditions.length === 0) {
        applicableRenditions.push(HLS_RENDITIONS[0])
      }

      for (const rendition of applicableRenditions) {
        const renditionDir = join(hlsDir, `${rendition.height}p`)
        mkdirSync(renditionDir, { recursive: true })

        execFileSync(
          "ffmpeg",
          [
            "-y",
            "-i",
            inputPath,
            "-vf",
            `scale=-2:${rendition.height}`,
            "-c:v",
            "libx264",
            "-preset",
            STREAM_VIDEO_PRESET,
            "-crf",
            String(rendition.crf),
            "-maxrate",
            rendition.bitrate,
            "-bufsize",
            `${Number.parseInt(rendition.bitrate, 10) * 2}k`,
            "-force_key_frames",
            `expr:gte(t,n_forced*${HLS_SEGMENT_DURATION})`,
            "-c:a",
            "aac",
            "-b:a",
            rendition.audioBitrate,
            "-f",
            "hls",
            "-hls_time",
            String(HLS_SEGMENT_DURATION),
            "-hls_playlist_type",
            "vod",
            "-hls_segment_filename",
            join(renditionDir, "seg_%03d.ts"),
            join(renditionDir, "playlist.m3u8"),
          ],
          { stdio: "pipe" }
        )

        process.stdout.write(` ${rendition.height}p`)
      }

      generateMasterPlaylist(
        hlsDir,
        applicableRenditions.map((r) => ({
          height: r.height,
          bitrate: r.bitrate,
        }))
      )

      process.stdout.write(" done\n")
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
