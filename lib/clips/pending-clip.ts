// A Clip draft parked in localStorage while a Guest goes through the auth
// flow (ADR-0003 taste-then-convert). Every auth path navigates away (Google /
// magic-link redirect, even email/password does a full location.assign), so an
// in-memory draft can't survive — it has to live somewhere durable and be
// replayed wherever the User lands. See pending-clip-replay.tsx.

const KEY = "uf:pendingClip"
const MAX_AGE_MS = 60 * 60 * 1000 // 1h — ignore a draft older than this

export interface PendingClip {
  endSeconds: number
  fileId: number
  startSeconds: number
  ts: number
}

export function writePendingClip(draft: Omit<PendingClip, "ts">): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    const payload: PendingClip = { ...draft, ts: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Private mode / quota — non-fatal, the draft is just lost.
  }
}

export function clearPendingClip(): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** Returns a fresh, well-formed pending clip, or null. Clears stale/garbage. */
export function readPendingClip(): PendingClip | null {
  if (typeof window === "undefined") {
    return null
  }
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingClip>
    const valid =
      typeof parsed.fileId === "number" &&
      typeof parsed.startSeconds === "number" &&
      typeof parsed.endSeconds === "number" &&
      typeof parsed.ts === "number" &&
      parsed.endSeconds > parsed.startSeconds
    if (!valid) {
      clearPendingClip()
      return null
    }
    if (Date.now() - (parsed.ts as number) > MAX_AGE_MS) {
      clearPendingClip()
      return null
    }
    return parsed as PendingClip
  } catch {
    clearPendingClip()
    return null
  }
}
