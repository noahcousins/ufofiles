// Type-only import — fully erased at build time, so this never pulls the
// server-only `auth` (drizzle, env, …) into the client bundle.
import type { auth } from "@/lib/auth"

/** The full `{ session, user }` shape better-auth returns server-side. */
export type FullSession = typeof auth.$Infer.Session

/**
 * The session shape we expose to the client. Strips the session `token` (the
 * httpOnly-cookie secret — it must never be serialized into the page or held in
 * client JS) plus the `ipAddress`/`userAgent` audit fields the UI never reads.
 */
export interface ClientSession {
  session: Pick<
    FullSession["session"],
    "id" | "userId" | "expiresAt" | "createdAt" | "updatedAt"
  >
  user: FullSession["user"]
}

/** Narrow a full session to the client-safe shape. `null` passes through. */
export function toClientSession(
  full: FullSession | null
): ClientSession | null {
  if (!full) {
    return null
  }
  const { id, userId, expiresAt, createdAt, updatedAt } = full.session
  return {
    user: full.user,
    session: { id, userId, expiresAt, createdAt, updatedAt },
  }
}
