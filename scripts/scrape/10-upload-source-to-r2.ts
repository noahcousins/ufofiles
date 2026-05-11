import { createReadStream, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import {
  RELEASE,
  SOURCE_DIR,
  UPLOAD_PART_SIZE,
  UPLOAD_QUEUE_SIZE,
} from "./config"
import { info, progress, summary } from "./logger"
import type { DownloadStats } from "./types"
import { getMimeType } from "./utils"

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return val
}

async function listExistingObjects(
  s3: S3Client,
  bucket: string
): Promise<Map<string, number>> {
  const existing = new Map<string, number>()
  let continuationToken: string | undefined

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${RELEASE}/`,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) {
        existing.set(obj.Key, obj.Size ?? 0)
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return existing
}

export async function main() {
  info("Step 10: Uploading source files to R2\n")

  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")
  const bucket = requireEnv("R2_SOURCE_BUCKET_NAME")

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  info("Listing existing R2 objects...")
  const existing = await listExistingObjects(s3, bucket)
  info(`Found ${existing.size} existing objects in R2\n`)

  const localFiles = readdirSync(SOURCE_DIR).filter((f) => !f.startsWith("."))
  info(`${localFiles.length} local files to upload\n`)

  const stats: DownloadStats = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: localFiles.length,
  }

  for (let i = 0; i < localFiles.length; i++) {
    const filename = localFiles[i]
    const filePath = join(SOURCE_DIR, filename)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      continue
    }

    const key = `${RELEASE}/${filename}`
    const remoteSize = existing.get(key)

    // skip if already uploaded with matching size
    if (remoteSize !== undefined && remoteSize === stat.size) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      stats.success++
      continue
    }

    try {
      const mb = (stat.size / 1024 / 1024).toFixed(1)
      process.stdout.write(
        `[${i + 1}/${stats.total}] Uploading: ${filename} (${mb} MB)...`
      )

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: getMimeType(filename),
        },
        queueSize: UPLOAD_QUEUE_SIZE,
        partSize: UPLOAD_PART_SIZE,
      })

      upload.on("httpUploadProgress", (p) => {
        if (p.loaded && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100)
          process.stdout.write(
            `\r[${i + 1}/${stats.total}] Uploading: ${filename} (${mb} MB)... ${pct}%`
          )
        }
      })

      await upload.done()
      process.stdout.write(
        `\r[${i + 1}/${stats.total}] OK: ${filename} (${mb} MB)          \n`
      )
      stats.success++
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      progress(i, stats.total, "FAIL", filename, msg)
      stats.failed++
    }
  }

  summary([
    `Done! ${stats.success - stats.skipped} uploaded, ${stats.skipped} skipped, ${stats.failed} failed`,
    `Bucket: ${bucket}`,
    `Prefix: ${RELEASE}/`,
  ])
}

if (process.argv[1]?.includes("10-upload-source-to-r2")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
