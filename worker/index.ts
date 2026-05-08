export interface Env {
  R2_BUCKET: R2Bucket
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
}

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW = 60

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

    const object = await env.R2_BUCKET.get(key)

    if (!object) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS })
    }

    const headers = new Headers({
      ...CORS_HEADERS,
      "Content-Type": object.httpMetadata?.contentType ?? getMimeType(key),
      "Cache-Control": IMMUTABLE_CACHE,
    })

    if (object.size) {
      headers.set("Content-Length", object.size.toString())
    }

    if (rateLimitRemaining !== undefined) {
      headers.set("X-RateLimit-Remaining", String(rateLimitRemaining))
    }

    const filename = key.split("/").pop() ?? key
    headers.set("Content-Disposition", `inline; filename="${filename}"`)

    return new Response(object.body, { headers })
  },
}
