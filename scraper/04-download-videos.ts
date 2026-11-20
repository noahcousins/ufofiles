import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  DVIDS_API_BASE,
  DVIDS_API_KEY,
  RECORDS_PATH,
  SOURCE_DIR,
  VIDEO_BATCH_PAUSE_MS,
  VIDEO_BATCH_SIZE,
  WAR_GOV_UFO,
} from "./config"
import { info, progress, summary } from "./logger"
import type { DownloadStats, DvidsApiResponse, UfoRecord } from "./types"
import { fileExists, sleep, withRetry } from "./utils"

const VIDEO_EXT_RE = /\.[a-z0-9]+$/i
const SAFE_NAME_RE = /[^a-zA-Z0-9_-]/g

/**
 * deduplicate records by video ID and assign stable filenames.
 * When multiple video IDs share the same title, appends _vid{id} to disambiguate.
 */
function resolveVideos(records: UfoRecord[]): {
  unique: UfoRecord[]
  nameFor: (videoId: string) => string
} {
  const seen = new Set<string>()
  const unique: UfoRecord[] = []
  for (const r of records) {
    if (r.videoId && !seen.has(r.videoId)) {
      seen.add(r.videoId)
      unique.push(r)
    }
  }

  const nameOwners = new Map<string, string>()
  const resolved = new Map<string, string>()
  for (const r of unique) {
    const base = r.title.replace(SAFE_NAME_RE, "_")
    const owner = nameOwners.get(base)
    if (!owner) {
      nameOwners.set(base, r.videoId)
      resolved.set(r.videoId, base)
    } else if (owner !== r.videoId) {
      // collision - suffix this one (and retroactively suffix the first owner too)
      if (resolved.get(owner) === base) {
        resolved.set(owner, `${base}_vid${owner}`)
      }
      resolved.set(r.videoId, `${base}_vid${r.videoId}`)
    }
  }

  return {
    unique,
    nameFor: (videoId: string) => resolved.get(videoId) ?? videoId,
  }
}

export async function main() {
  info("Step 4: Downloading videos via DVIDS API\n")

  if (!DVIDS_API_KEY) {
    throw new Error(
      "DVIDS_API_KEY is not set — add it to .env.local (see .env.example)."
    )
  }

  const records: UfoRecord[] = JSON.parse(readFileSync(RECORDS_PATH, "utf-8"))
  const { unique, nameFor } = resolveVideos(records)

  info(`${unique.length} unique videos to download into ${SOURCE_DIR}\n`)
  mkdirSync(SOURCE_DIR, { recursive: true })

  const stats: DownloadStats = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: unique.length,
  }

  for (let i = 0; i < unique.length; i++) {
    const record = unique[i]
    const safeName = nameFor(record.videoId)

    // check if we already have this video
    const alreadyDownloaded = [".mp4", ".webm", ".mov"].some((ext) =>
      fileExists(join(SOURCE_DIR, safeName + ext))
    )

    if (alreadyDownloaded) {
      progress(i, stats.total, "SKIP", safeName)
      stats.skipped++
      stats.success++
      continue
    }

    try {
      // fetch video metadata from DVIDS API
      const apiUrl = `${DVIDS_API_BASE}?id=video:${record.videoId}&api_key=${DVIDS_API_KEY}`

      const meta: DvidsApiResponse = await withRetry(
        async () => {
          const res = await fetch(apiUrl, {
            headers: {
              Referer: WAR_GOV_UFO,
              Origin: "https://www.war.gov",
            },
          })
          if (!res.ok) {
            const err = new Error(`DVIDS API ${res.status}`) as Error & {
              status: number
            }
            err.status = res.status
            throw err
          }
          return res.json() as Promise<DvidsApiResponse>
        },
        { label: safeName }
      )

      const result = meta.results
      if (!result?.files?.length) {
        progress(i, stats.total, "FAIL", safeName, "no files in API response")
        stats.failed++
        continue
      }

      // pick the highest quality file (first is usually the original)
      const best = result.files[0]
      const ext = best.src.match(VIDEO_EXT_RE)?.[0] ?? ".mp4"
      const outPath = join(SOURCE_DIR, safeName + ext)
      const mb = (best.size / 1024 / 1024).toFixed(1)

      info(
        `[${i + 1}/${stats.total}] Downloading: ${result.title} (${mb} MB)...`
      )

      // download the video file from CloudFront CDN
      const arrayBuf = await withRetry(
        async () => {
          const res = await fetch(best.src)
          if (!res.ok) {
            const err = new Error(`CDN ${res.status}`) as Error & {
              status: number
            }
            err.status = res.status
            throw err
          }
          return res.arrayBuffer()
        },
        { label: safeName }
      )

      writeFileSync(outPath, Buffer.from(arrayBuf))

      const actualMb = (arrayBuf.byteLength / 1024 / 1024).toFixed(1)
      progress(i, stats.total, "OK", `${safeName}${ext}`, `${actualMb} MB`)
      stats.success++

      // save metadata sidecar
      const metaPath = join(SOURCE_DIR, `${safeName}_meta.json`)
      writeFileSync(
        metaPath,
        JSON.stringify(
          {
            title: result.title,
            description: result.description,
            date: result.date,
            duration: result.duration,
            unit: result.unit_name,
            branch: result.branch,
            url: result.url,
            files: result.files,
          },
          null,
          2
        )
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "ERROR", safeName, msg)
      stats.failed++
    }

    // brief pause between downloads
    if (i % VIDEO_BATCH_SIZE === VIDEO_BATCH_SIZE - 1) {
      await sleep(VIDEO_BATCH_PAUSE_MS)
    }
  }

  summary([
    `Done! ${stats.success} ok (${stats.skipped} skipped), ${stats.failed} failed`,
    `Videos in: ${SOURCE_DIR}`,
  ])
}

if (process.argv[1]?.includes("04-download-videos")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
