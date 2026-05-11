export type BucketType = "source" | "assets" | "downloads"

const BUCKET_PREFIXES = new Set<string>(["source", "assets", "downloads"])
const SOURCE_REGEX = /^source\//

export function parseBucketPrefix(r2Key: string): {
  bucket: BucketType
  objectKey: string
} {
  const slash = r2Key.indexOf("/")
  const prefix = slash > 0 ? r2Key.slice(0, slash) : ""
  if (BUCKET_PREFIXES.has(prefix)) {
    return {
      bucket: prefix as BucketType,
      objectKey: r2Key.slice(slash + 1),
    }
  }
  // legacy key without a bucket prefix, default to source
  return { bucket: "source", objectKey: r2Key }
}

export function sourceToAssets(r2Key: string): string {
  return r2Key.replace(SOURCE_REGEX, "assets/")
}

export function extractRelease(r2Key: string): string | null {
  const parts = r2Key.split("/")
  if (parts.length >= 3 && BUCKET_PREFIXES.has(parts[0])) {
    return parts[1]
  }
  return parts[0] ?? null
}
