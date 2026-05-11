import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import {
  CARD_THUMB_DIR,
  PDF_PREVIEW_DIR,
  RELEASE,
  TRANSCRIPT_DIR,
  UPLOAD_PART_SIZE,
  UPLOAD_QUEUE_SIZE,
  VIDEO_PREVIEW_DIR,
  VIDEO_STREAM_DIR,
} from "./config"
import { info, progress, summary } from "./logger"
import type { DownloadStats } from "./types"
import { fileExists } from "./utils"

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return val
}

interface AssetFile {
  contentType: string
  key: string
  localPath: string
}

/** collect PDF page images from nested pdf-pages/{stem}/ directories. */
function collectPdfPages(files: AssetFile[]): void {
  try {
    for (const stem of readdirSync(PDF_PREVIEW_DIR)) {
      const stemDir = join(PDF_PREVIEW_DIR, stem)
      if (!statSync(stemDir).isDirectory()) {
        continue
      }
      for (const page of readdirSync(stemDir)) {
        if (page.endsWith(".jpg")) {
          files.push({
            key: `${RELEASE}/pdf-pages/${stem}/${page}`,
            localPath: join(stemDir, page),
            contentType: "image/jpeg",
          })
        }
      }
    }
  } catch {
    // pdf-pages dir may not exist
  }

  const manifestPath = join(PDF_PREVIEW_DIR, "manifest.json")
  if (fileExists(manifestPath)) {
    files.push({
      key: `${RELEASE}/pdf-pages/manifest.json`,
      localPath: manifestPath,
      contentType: "application/json",
    })
  }
}

/** collect video thumbnails and preview GIFs. */
function collectVideoPreviews(files: AssetFile[]): void {
  try {
    for (const file of readdirSync(VIDEO_PREVIEW_DIR)) {
      const filePath = join(VIDEO_PREVIEW_DIR, file)
      if (statSync(filePath).isDirectory()) {
        continue
      }
      if (file.endsWith("_thumb.jpg")) {
        files.push({
          key: `${RELEASE}/video-thumbs/${file}`,
          localPath: filePath,
          contentType: "image/jpeg",
        })
      } else if (file.endsWith("_preview.gif")) {
        files.push({
          key: `${RELEASE}/video-previews/${file}`,
          localPath: filePath,
          contentType: "image/gif",
        })
      }
    }
  } catch {
    // previews dir may not exist
  }
}

/** collect flat directory of files matching an extension. */
function collectFlatDir(
  dir: string,
  ext: string,
  r2Prefix: string,
  contentType: string,
  files: AssetFile[]
): void {
  try {
    for (const file of readdirSync(dir)) {
      if (file.endsWith(ext)) {
        files.push({
          key: `${RELEASE}/${r2Prefix}/${file}`,
          localPath: join(dir, file),
          contentType,
        })
      }
    }
  } catch {
    // dir may not exist
  }
}

/** collect all asset files to upload. */
function collectAssetFiles(): AssetFile[] {
  const files: AssetFile[] = []
  collectPdfPages(files)
  collectVideoPreviews(files)
  collectFlatDir(CARD_THUMB_DIR, ".webp", "card-thumbs", "image/webp", files)
  collectFlatDir(VIDEO_STREAM_DIR, ".mp4", "video-stream", "video/mp4", files)
  collectFlatDir(TRANSCRIPT_DIR, ".txt", "transcripts", "text/plain", files)
  return files
}

/** list existing objects in the assets bucket for skip logic */
async function listExistingAssets(
  s3: S3Client,
  bucket: string
): Promise<Map<string, number>> {
  const existing = new Map<string, number>()
  const prefixes = [
    `${RELEASE}/pdf-pages/`,
    `${RELEASE}/video-thumbs/`,
    `${RELEASE}/video-previews/`,
    `${RELEASE}/card-thumbs/`,
    `${RELEASE}/video-stream/`,
    `${RELEASE}/transcripts/`,
  ]

  for (const prefix of prefixes) {
    let continuationToken: string | undefined

    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      )
      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          existing.set(obj.Key, obj.Size ?? 0)
        }
      }
      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined
    } while (continuationToken)
  }

  return existing
}

export async function main() {
  info("Step 11: Uploading assets to R2\n")

  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")
  const bucket = requireEnv("R2_ASSETS_BUCKET_NAME")

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  // collect all asset files
  const previewFiles = collectAssetFiles()
  info(`${previewFiles.length} asset files to upload\n`)

  if (previewFiles.length === 0) {
    summary(["No asset files to upload"])
    return
  }

  // list existing assets for skip logic
  info("Listing existing R2 assets...")
  const existing = await listExistingAssets(s3, bucket)
  info(`Found ${existing.size} existing asset objects\n`)

  const stats: DownloadStats = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: previewFiles.length,
  }

  // always upload manifest (small, may have changed)
  const manifestKey = `${RELEASE}/pdf-pages/manifest.json`

  for (let i = 0; i < previewFiles.length; i++) {
    const pf = previewFiles[i]
    const localStat = statSync(pf.localPath)
    const remoteSize = existing.get(pf.key)

    // skip if already uploaded with matching size (except manifest)
    if (
      pf.key !== manifestKey &&
      remoteSize !== undefined &&
      remoteSize === localStat.size
    ) {
      progress(i, stats.total, "SKIP", pf.key)
      stats.skipped++
      stats.success++
      continue
    }

    try {
      const kb = (localStat.size / 1024).toFixed(0)
      process.stdout.write(
        `[${i + 1}/${stats.total}] Uploading: ${pf.key} (${kb} KB)...`
      )

      // use readFileSync for small files, streaming for larger ones
      const body =
        localStat.size < 5 * 1024 * 1024
          ? readFileSync(pf.localPath)
          : createReadStream(pf.localPath)

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: pf.key,
          Body: body,
          ContentType: pf.contentType,
        },
        queueSize: UPLOAD_QUEUE_SIZE,
        partSize: UPLOAD_PART_SIZE,
      })

      await upload.done()
      process.stdout.write(" done\n")
      stats.success++
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", pf.key, msg)
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.success - stats.skipped} uploaded, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Bucket: ${bucket}`,
  ])
}

if (process.argv[1]?.includes("11-upload-assets-to-r2")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
