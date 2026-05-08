import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

export interface R2File {
  key: string
  lastModified: string
  size: number
}

export async function listAllFiles(prefix?: string): Promise<R2File[]> {
  const files: R2File[] = []
  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
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
  const limit = Math.min(opts?.limit ?? 100, 1000)

  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: opts?.prefix,
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

export async function getFile(key: string, range?: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
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
