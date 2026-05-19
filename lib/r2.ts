import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { parseBucketPrefix } from "./r2-paths"

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAMES: Record<string, string | undefined> = {
  source: process.env.R2_SOURCE_BUCKET_NAME,
  assets: process.env.R2_ASSETS_BUCKET_NAME,
  downloads: process.env.R2_DOWNLOADS_BUCKET_NAME,
}

const LEGACY_BUCKET = process.env.R2_BUCKET_NAME

function resolveBucket(r2Key: string): { bucket: string; objectKey: string } {
  const { bucket, objectKey } = parseBucketPrefix(r2Key)
  const bucketName = BUCKET_NAMES[bucket]
  if (bucketName) {
    return { bucket: bucketName, objectKey }
  }
  // Legacy fallback
  return { bucket: LEGACY_BUCKET ?? BUCKET_NAMES.source!, objectKey: r2Key }
}

export interface R2File {
  key: string
  lastModified: string
  size: number
}

export async function listAllFiles(prefix?: string): Promise<R2File[]> {
  const { bucket, objectKey } = prefix
    ? resolveBucket(prefix)
    : { bucket: LEGACY_BUCKET ?? BUCKET_NAMES.source!, objectKey: undefined }

  const files: R2File[] = []
  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: objectKey,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    })

    const response = await r2.send(command)

    for (const obj of response.Contents ?? []) {
      if (!obj.Key) {
        continue
      }
      files.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? "",
      })
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined
  } while (continuationToken)

  return files
}

export async function listFiles(opts?: {
  prefix?: string
  limit?: number
  cursor?: string
}): Promise<{
  files: R2File[]
  cursor: string | null
  hasMore: boolean
}> {
  const { bucket, objectKey } = opts?.prefix
    ? resolveBucket(opts.prefix)
    : { bucket: LEGACY_BUCKET ?? BUCKET_NAMES.source!, objectKey: undefined }

  const limit = Math.min(opts?.limit ?? 100, 1000)

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: objectKey,
    MaxKeys: limit,
    ContinuationToken: opts?.cursor,
  })

  const response = await r2.send(command)

  const files: R2File[] = (response.Contents ?? [])
    .filter((obj) => obj.Key)
    .map((obj) => ({
      key: obj.Key!,
      size: obj.Size ?? 0,
      lastModified: obj.LastModified?.toISOString() ?? "",
    }))

  return {
    files,
    cursor: response.NextContinuationToken ?? null,
    hasMore: response.IsTruncated ?? false,
  }
}

export async function getFileAsBuffer(key: string): Promise<Buffer | null> {
  const file = await getFile(key)
  if (!file) {
    return null
  }
  const response = new Response(file.body)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function putFile(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<void> {
  const { bucket, objectKey } = resolveBucket(key)
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: typeof body === "string" ? Buffer.from(body, "utf-8") : body,
      ContentType: contentType,
    })
  )
}

export async function getFile(key: string, range?: string) {
  const { bucket, objectKey } = resolveBucket(key)

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ...(range ? { Range: range } : {}),
  })

  const response = await r2.send(command)

  if (!response.Body) {
    return null
  }

  return {
    body: response.Body.transformToWebStream(),
    contentType: response.ContentType ?? "application/octet-stream",
    contentLength: response.ContentLength ?? 0,
    contentRange: response.ContentRange,
    lastModified: response.LastModified?.toISOString() ?? "",
  }
}
