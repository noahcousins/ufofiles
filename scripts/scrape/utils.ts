import { execFileSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { MAX_RETRIES, RETRY_BASE_DELAY_MS } from "./config"

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

export const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".json": "application/json",
}

export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase()
  return MIME_TYPES[ext] ?? "application/octet-stream"
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

const EXT_RE = /\.[a-z0-9]+$/i

/** Extract a file extension from a URL, falling back to the record's type. */
export function getExtension(url: string, type: string): string {
  if (url) {
    const match = url.split("?")[0].match(EXT_RE)
    if (match) {
      return match[0].toLowerCase()
    }
  }
  if (type) {
    const t = type.trim().toLowerCase()
    return t.startsWith(".") ? t : `.${t}`
  }
  return ".pdf"
}

/** Convert a title to a filesystem-safe filename. */
export function toSafeName(title: string, ext: string): string {
  return title.replace(/[^a-zA-Z0-9_-]/g, "_") + ext
}

/** Check whether a file exists and has non-zero size. */
export function fileExists(path: string): boolean {
  return existsSync(path) && statSync(path).size > 0
}

// ---------------------------------------------------------------------------
// Binary helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a system binary exists on PATH.
 * Exits with a helpful message if not found.
 */
export function requireBinary(name: string, installHint: string): void {
  try {
    execFileSync("which", [name], { stdio: "ignore" })
  } catch {
    console.error(`Error: ${name} not found on PATH.`)
    console.error("Install it:")
    console.error("")
    console.error(`  ${installHint}`)
    console.error("")
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Retry an async operation with exponential backoff.
 * Retries on 5xx / network errors; does NOT retry 4xx.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelay?: number; label?: string } = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES
  const baseDelay = opts.baseDelay ?? RETRY_BASE_DELAY_MS

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Don't retry client errors (4xx)
      const status = (err as { status?: number }).status
      if (status && status >= 400 && status < 500) {
        throw lastError
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * 2 ** attempt
        if (opts.label) {
          console.warn(
            `  Retry ${attempt + 1}/${maxRetries} for ${opts.label} in ${delay}ms`
          )
        }
        await sleep(delay)
      }
    }
  }

  // lastError is guaranteed to be set if we reach here (loop ran at least once)
  throw lastError as Error
}
