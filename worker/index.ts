export interface Env {
  R2_ASSETS: R2Bucket
  R2_DOWNLOADS: R2Bucket
  R2_LEGACY?: R2Bucket
  R2_SOURCE: R2Bucket
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers":
    "Content-Range, Content-Length, Accept-Ranges",
}

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW = 60

function parseRange(
  range: string
): { offset: number; length?: number } | { suffix: number } {
  const match = range.match(/bytes=(\d*)-(\d*)/)
  if (!match) {
    return { offset: 0 }
  }
  const [, startStr, endStr] = match
  // suffix range: bytes=-500 (last 500 bytes)
  if (!startStr && endStr) {
    return { suffix: Number.parseInt(endStr, 10) }
  }
  const offset = Number.parseInt(startStr, 10)
  if (endStr) {
    return { offset, length: Number.parseInt(endStr, 10) - offset + 1 }
  }
  return { offset }
}

function getMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase()
  const types: Record<string, string> = {
    pdf: "application/pdf",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    json: "application/json",
    m3u8: "application/vnd.apple.mpegurl",
    ts: "video/mp2t",
  }
  return types[ext ?? ""] ?? "application/octet-stream"
}

function isExemptFromRateLimit(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return ["json", "jpg", "jpeg", "png", "webp", "gif", "m3u8", "ts"].includes(
    ext
  )
}

async function checkRateLimit(
  request: Request
): Promise<{ limited: boolean; remaining: number }> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown"
  const cacheKey = new Request(`https://rate-limit.internal/__rl/${ip}`, {
    method: "GET",
  })
  const cache = caches.default

  const cached = await cache.match(cacheKey)
  let count = 0
  if (cached) {
    count = Number.parseInt(await cached.text(), 10) || 0
  }

  if (count >= RATE_LIMIT_MAX) {
    return { limited: true, remaining: 0 }
  }

  const updated = new Response(String(count + 1), {
    headers: { "Cache-Control": `max-age=${RATE_LIMIT_WINDOW}` },
  })
  await cache.put(cacheKey, updated)

  return { limited: false, remaining: RATE_LIMIT_MAX - count - 1 }
}

function resolveBucket(
  rawPath: string,
  env: Env
): { bucket: R2Bucket; objectKey: string } | null {
  const slashIdx = rawPath.indexOf("/")
  const prefix = slashIdx > 0 ? rawPath.slice(0, slashIdx) : ""
  const rest = slashIdx > 0 ? rawPath.slice(slashIdx + 1) : rawPath

  switch (prefix) {
    case "source":
      return { bucket: env.R2_SOURCE, objectKey: rest }
    case "assets":
      return { bucket: env.R2_ASSETS, objectKey: rest }
    case "downloads":
      return { bucket: env.R2_DOWNLOADS, objectKey: rest }
    default:
      // Legacy fallback: no recognized prefix means old-style key
      if (env.R2_LEGACY) {
        return { bucket: env.R2_LEGACY, objectKey: rawPath }
      }
      return null
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 })
    }

    const url = new URL(request.url)
    const rawPath = decodeURIComponent(url.pathname.slice(1)) // strip leading /

    if (!rawPath) {
      return new Response("Not Found", { status: 404 })
    }

    const resolved = resolveBucket(rawPath, env)
    if (!resolved) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    const { bucket, objectKey } = resolved
    const rangeHeader = request.headers.get("Range")

    // Check Cloudflare edge cache (non-range GET requests only)
    const cache = caches.default
    if (request.method === "GET" && !rangeHeader) {
      const cached = await cache.match(request)
      if (cached) {
        return cached
      }
    }

    let rateLimitRemaining: number | undefined
    if (!isExemptFromRateLimit(objectKey)) {
      const { limited, remaining } = await checkRateLimit(request)
      if (limited) {
        return new Response("Too Many Requests", {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Retry-After": String(RATE_LIMIT_WINDOW),
          },
        })
      }
      rateLimitRemaining = remaining
    }

    // Fetch from the resolved bucket
    let object = rangeHeader
      ? await bucket.get(objectKey, { range: parseRange(rangeHeader) })
      : await bucket.get(objectKey)

    // Legacy fallback: if not found in new bucket, try the legacy bucket with the full raw path
    if (!object && env.R2_LEGACY && bucket !== env.R2_LEGACY) {
      object = rangeHeader
        ? await env.R2_LEGACY.get(rawPath, { range: parseRange(rangeHeader) })
        : await env.R2_LEGACY.get(rawPath)
    }

    if (!object) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    const contentType =
      object.httpMetadata?.contentType ?? getMimeType(objectKey)
    const totalSize = object.size

    const headers = new Headers({
      ...CORS_HEADERS,
      "Content-Type": contentType,
      "Cache-Control": IMMUTABLE_CACHE,
      "Accept-Ranges": "bytes",
    })

    if (rateLimitRemaining !== undefined) {
      headers.set("X-RateLimit-Remaining", String(rateLimitRemaining))
    }

    const filename = objectKey.split("/").pop() ?? objectKey
    const disposition = filename.endsWith(".zip") ? "attachment" : "inline"
    headers.set("Content-Disposition", `${disposition}; filename="${filename}"`)

    // Respond with 206 Partial Content for Range requests (not cached)
    if (rangeHeader && "range" in object) {
      const { offset, length } = object.range as {
        offset: number
        length: number
      }
      headers.set("Content-Length", length.toString())
      headers.set(
        "Content-Range",
        `bytes ${offset}-${offset + length - 1}/${totalSize}`
      )
      return new Response(object.body, { status: 206, headers })
    }

    if (totalSize) {
      headers.set("Content-Length", totalSize.toString())
    }

    const response = new Response(object.body, { headers })

    // Cache full GET responses at Cloudflare's edge
    if (request.method === "GET") {
      ctx.waitUntil(cache.put(request, response.clone()))
    }

    return response
  },
}
