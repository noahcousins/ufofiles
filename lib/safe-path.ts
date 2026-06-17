/**
 * The current page as a relative `path?query` string. Read at event time (e.g.
 * in a click handler) so sign-in can return the user to the exact page —
 * including the query — without `useSearchParams` forcing a static-render
 * bailout in a layout-level component. Client-only; call inside an event handler.
 */
export function currentRelativePath(): string {
  return window.location.pathname + window.location.search
}

/**
 * Returns `value` only if it's a safe same-origin path (`/foo`, never `//evil`,
 * `/\evil`, a `\`-smuggled host, or an absolute URL), otherwise `fallback`.
 * Guards `?redirect`/`?next` params against being used as open redirects.
 *
 * Validation is two-layer: cheap prefix checks reject the obvious bad shapes,
 * then `new URL(value, throwaway)` confirms it resolves same-origin. We return
 * the *parsed* path (not the raw input), which normalizes away any control
 * chars the browser would otherwise strip inconsistently.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback
  }
  // Reject anything not rooted at a single slash: protocol-relative (`//`) and
  // backslash-smuggled hosts (`/\evil` — browsers normalize `\` → `/`).
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback
  }
  // Resolve against a throwaway origin; reject anything that escapes it.
  try {
    const url = new URL(value, "https://internal.invalid")
    if (url.origin !== "https://internal.invalid") {
      return fallback
    }
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

/**
 * Hard-navigate to an internal path, validating at the sink so an unsanitized
 * value can never reach `location.assign`. Off-origin/garbage uses `fallback`.
 */
export function navigateInternal(
  value: string | null | undefined,
  fallback = "/"
): void {
  window.location.assign(safeInternalPath(value, fallback))
}
