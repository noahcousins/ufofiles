import { promises as dns } from "node:dns"
import disposableDomains from "disposable-email-domains"
import { cacheKey, withCache } from "@/lib/cache"

// Loaded once per server process. The package is a plain ~120k-entry array of
// disposable/throwaway domains; a Set makes the lookup O(1).
const DISPOSABLE = new Set(disposableDomains as string[])

// MX results are stable; cache per-domain so a popular domain is resolved once.
const MX_TTL_SECONDS = 60 * 60 * 24

export interface EmailValidation {
  ok: boolean
  reason?: string
}

/**
 * Validate an address before we send to it or create an account (ADR-0004).
 * Local checks only — disposable-domain blocklist + a conservative, fail-open
 * MX/DNS lookup. This is NOT verification (ownership); it's a deliverability +
 * non-disposable gate.
 */
export async function validateSignupEmail(
  email: string
): Promise<EmailValidation> {
  const domain = email.trim().toLowerCase().split("@")[1]
  if (!domain) {
    return { ok: false, reason: "Enter a valid email address." }
  }
  if (DISPOSABLE.has(domain)) {
    return {
      ok: false,
      reason:
        "Please use a permanent email, disposable addresses are not allowed.",
    }
  }
  if (!(await domainAcceptsMail(domain))) {
    return {
      ok: false,
      reason: "We couldn't reach that email's domain, check for a typo.",
    }
  }
  return { ok: true }
}

function domainAcceptsMail(domain: string): Promise<boolean> {
  return withCache(
    cacheKey("email:mx", { domain }),
    MX_TTL_SECONDS,
    async () => {
      try {
        const mx = await dns.resolveMx(domain)
        return mx.length > 0
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === "ENODATA") {
          // No MX records, but a domain with an A record can still accept mail
          // (implicit MX, RFC 5321) — don't reject those.
          const a = await dns.resolve4(domain).catch(() => [])
          return a.length > 0
        }
        if (code === "ENOTFOUND") {
          // Domain doesn't exist — almost always a typo.
          return false
        }
        // Transient (timeout / SERVFAIL / etc.) → fail open, never block a real
        // sign-up on a DNS hiccup.
        return true
      }
    }
  )
}
