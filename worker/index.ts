export interface Env {
  R2_BUCKET: R2Bucket
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
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
  }
  return types[ext ?? ""] ?? "application/octet-stream"
}

function isExemptFromRateLimit(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return ["json", "jpg", "jpeg", "png", "webp", "gif"].includes(ext)
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 })
    }

    const url = new URL(request.url)
    const key = decodeURIComponent(url.pathname.slice(1)) // strip leading /

    if (!key) {
      return new Response("Not Found", { status: 404 })
    }

    let rateLimitRemaining: number | undefined
    if (!isExemptFromRateLimit(key)) {
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

    const rangeHeader = request.headers.get("Range")

    // For Range requests, use R2's native range support
    const object = rangeHeader
      ? await env.R2_BUCKET.get(key, { range: parseRange(rangeHeader) })
      : await env.R2_BUCKET.get(key)

    if (!object) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    const contentType =
      object.httpMetadata?.contentType ?? getMimeType(key)
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

    const filename = key.split("/").pop() ?? key
    const disposition = filename.endsWith(".zip") ? "attachment" : "inline"
    headers.set("Content-Disposition", `${disposition}; filename="${filename}"`)

    // Respond with 206 Partial Content for Range requests
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

    return new Response(object.body, { headers })
  },
}
