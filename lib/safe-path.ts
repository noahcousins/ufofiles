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
 * Returns `value` only if it's a safe same-origin path (`/foo`, never `//evil`
 * or an absolute URL), otherwise `fallback`. Guards `?redirect`/`?next` params
 * against being used as open redirects.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback: string
): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value
  }
  return fallback
}
