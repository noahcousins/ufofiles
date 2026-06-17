import { Redis } from "@upstash/redis"
import superjson, { type SuperJSONResult } from "superjson"

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) {
    return redis
  }
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!(url && token)) {
      return null
    }
    redis = new Redis({ url, token })
    return redis
  } catch {
    return null
  }
}

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return ""
  }
  if (typeof obj !== "object") {
    return String(obj)
  }
  if (Array.isArray(obj)) {
    // Arrays are order-significant; recurse so nested objects sort too.
    return `[${obj.map((v) => stableStringify(v)).join(",")}]`
  }
  // Recurse into nested objects with sorted keys, so logically-equal inputs
  // (same keys/values, different key order, at ANY depth) map to one cache key.
  const record = obj as Record<string, unknown>
  const parts = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
  return `{${parts.join(",")}}`
}

export function cacheKey(procedure: string, input?: unknown): string {
  if (input === undefined || input === null) {
    return procedure
  }
  return `${procedure}:${stableStringify(input)}`
}

const VERSION_KEY = "trpc:cache-version"

export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const client = getRedis()
  if (!client) {
    return fetcher()
  }

  try {
    const version = (await client.get<number>(VERSION_KEY)) ?? 1
    const fullKey = `trpc:v${version}:${key}`

    const cached = await client.get<SuperJSONResult>(fullKey)
    if (cached) {
      return superjson.deserialize<T>(cached)
    }

    const result = await fetcher()
    const serialized = superjson.serialize(result)
    await client.set(fullKey, serialized, { ex: ttlSeconds })
    return result
  } catch {
    return fetcher()
  }
}

export async function bustCache(): Promise<void> {
  const client = getRedis()
  if (!client) {
    console.warn("Redis not configured - skipping cache bust")
    return
  }
  const newVersion = await client.incr(VERSION_KEY)
  console.log(`Cache version incremented to ${newVersion}`)
}
