import { createReadStream, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { releaseDownloads, releases } from "../../lib/db/schema"
import { RELEASE } from "./config"
import { info, progress, summary } from "./logger"
import type { DownloadStats } from "./types"

function resolveDir(): string {
  const idx = process.argv.indexOf("--dir")
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  return join(import.meta.dirname ?? ".", "..", "..", "archives")
}

const ARCHIVES_DIR = resolveDir()

const ZIP_RE = /\.zip$/i
const MAX_RETRIES = 3
/**
 * 200 MB parts, sequential (queueSize 1) - minimises open connections
 * to avoid the SSL "bad record mac" errors on long-lived transfers.
 */
const PART_SIZE = 200 * 1024 * 1024

/** Map archive filenames to user-facing labels and slugs for the DB. */
const ZIP_META: Record<string, { label: string; slug: string; sort: number }> =
  {
    [`2026_AARO_${RELEASE}_full.zip`]: {
      label: "Complete Archive",
      slug: "master",
      sort: 0,
    },
    [`2026_AARO_${RELEASE}_pdf.zip`]: {
      label: "PDF Documents",
      slug: "pdf",
      sort: 1,
    },
    [`2026_AARO_${RELEASE}_vid.zip`]: {
      label: "Videos",
      slug: "vid",
      sort: 2,
    },
    [`2026_AARO_${RELEASE}_img.zip`]: {
      label: "Images",
      slug: "img",
      sort: 3,
    },
    [`2026_AARO_${RELEASE}_json.zip`]: {
      label: "Structured Data (JSON)",
      slug: "json",
      sort: 4,
    },
  }

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

/** Upload a single file to R2 with sequential multipart + retries. */
async function uploadWithRetry(
  s3: S3Client,
  bucket: string,
  filePath: string,
  key: string,
  label: string
): Promise<boolean> {
  const fileSize = statSync(filePath).size
  const mb = (fileSize / 1024 / 1024).toFixed(1)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tag = attempt > 1 ? ` (retry ${attempt}/${MAX_RETRIES})` : ""
      const prefix = `${label} (${mb} MB)${tag}...`
      process.stdout.write(prefix)

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucket,
          Key: key,
          Body: createReadStream(filePath),
          ContentType: "application/zip",
        },
        // Sequential upload - one part at a time to avoid SSL connection issues
        queueSize: 1,
        partSize: PART_SIZE,
      })

      upload.on("httpUploadProgress", (p) => {
        if (p.loaded && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100)
          process.stdout.write(`\r${prefix} ${pct}%`)
        }
      })

      await upload.done()
      process.stdout.write(`\r${label} OK (${mb} MB)          \n`)
      return true
    } catch (err: unknown) {
      process.stdout.write("\n")
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
      if (attempt < MAX_RETRIES) {
        info(`  Attempt ${attempt} failed: ${msg} - retrying...`)
      } else {
        info(`  FAIL after ${MAX_RETRIES} attempts: ${msg}`)
      }
    }
  }
  return false
}

/** Sync uploaded files to the release_downloads table. */
async function syncDb(
  databaseUrl: string,
  uploaded: { filename: string; key: string; size: number }[]
): Promise<{ inserted: number; skipped: number }> {
  const client = postgres(databaseUrl)
  const db = drizzle(client)

  const [release] = await db
    .select({ id: releases.id })
    .from(releases)
    .where(eq(releases.name, RELEASE))
    .limit(1)

  if (!release) {
    info(`Release "${RELEASE}" not found - skipping DB sync`)
    await client.end()
    return { inserted: 0, skipped: 0 }
  }

  let inserted = 0
  let skipped = 0

  for (let idx = 0; idx < uploaded.length; idx++) {
    const { filename, key, size } = uploaded[idx]
    const meta = ZIP_META[filename] ?? {
      label: filename.replace(/\.zip$/i, "").replace(/[_-]/g, " "),
      slug: filename.replace(/\.zip$/i, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      sort: 10 + idx,
    }

    const r2Key = `downloads/${key}`
    const [row] = await db
      .select({ id: releaseDownloads.id })
      .from(releaseDownloads)
      .where(eq(releaseDownloads.r2Key, r2Key))
      .limit(1)

    if (row) {
      skipped++
      continue
    }

    await db.insert(releaseDownloads).values({
      releaseId: release.id,
      label: meta.label,
      slug: meta.slug,
      r2Key,
      fileSize: size,
      sortOrder: meta.sort,
    })

    info(`  Inserted: ${meta.label} (${meta.slug})`)
    inserted++
  }

  await client.end()
  return { inserted, skipped }
}

export async function main() {
  info("Uploading release downloads to R2\n")

  const accountId = requireEnv("R2_ACCOUNT_ID")
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY")
  const bucket = requireEnv("R2_DOWNLOADS_BUCKET_NAME")
  const databaseUrl = requireEnv("DATABASE_URL")

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  const zipFiles = readdirSync(ARCHIVES_DIR)
    .filter((f) => ZIP_RE.test(f))
    .sort()

  if (zipFiles.length === 0) {
    info("No zip files found in archives/")
    return
  }
  info(`Found ${zipFiles.length} zip files in archives/\n`)

  info("Listing existing R2 objects...")
  const existing = await listExistingObjects(s3, bucket)
  info(`Found ${existing.size} existing objects in R2\n`)

  const stats: DownloadStats = {
    success: 0,
    skipped: 0,
    failed: 0,
    total: zipFiles.length,
  }

  const uploaded: { filename: string; key: string; size: number }[] = []

  for (let i = 0; i < zipFiles.length; i++) {
    const filename = zipFiles[i]
    const filePath = join(ARCHIVES_DIR, filename)
    const localSize = statSync(filePath).size
    const key = `${RELEASE}/${filename}`
    const remoteSize = existing.get(key)

    if (remoteSize !== undefined && remoteSize === localSize) {
      progress(i, stats.total, "SKIP", filename)
      stats.skipped++
      stats.success++
      uploaded.push({ filename, key, size: localSize })
      continue
    }

    const label = `[${i + 1}/${stats.total}] ${filename}`
    const ok = await uploadWithRetry(s3, bucket, filePath, key, label)

    if (ok) {
      stats.success++
      uploaded.push({ filename, key, size: localSize })
    } else {
      stats.failed++
    }
  }

  info("\nSyncing release_downloads table...")
  const { inserted, skipped } = await syncDb(databaseUrl, uploaded)

  summary([
    `R2: ${stats.success - stats.skipped} uploaded, ${stats.skipped} skipped, ${stats.failed} failed`,
    `DB: ${inserted} inserted, ${skipped} already existed`,
    `Bucket: ${bucket}`,
    `Prefix: ${RELEASE}/`,
  ])
}

if (process.argv[1]?.includes("upload-downloads-to-r2")) {
  main().catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
}
