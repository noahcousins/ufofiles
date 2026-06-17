// Common consumer email domains, for client-side "did you mean…?" typo nudges.
// UX only — the real validation gate is server-side (ADR-0004).
const POPULAR_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "msn.com",
  "me.com",
  "ymail.com",
]

const MAX_DISTANCE = 2

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]
      prev[j] =
        a[i - 1] === b[j - 1] ? diag : 1 + Math.min(diag, prev[j], prev[j - 1])
      diag = temp
    }
  }
  return prev[b.length]
}

/**
 * Suggest a corrected address when the domain is a near-miss of a popular one
 * (e.g. `gmial.com` → `gmail.com`). Returns null when the domain is already
 * known-good or nothing is close enough.
 */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) {
    return null
  }
  const local = email.slice(0, at)
  const domain = email
    .slice(at + 1)
    .toLowerCase()
    .trim()
  if (!domain || domain.includes("@") || POPULAR_DOMAINS.includes(domain)) {
    return null
  }

  let best: string | null = null
  let bestDistance = MAX_DISTANCE + 1
  for (const candidate of POPULAR_DOMAINS) {
    const distance = levenshtein(domain, candidate)
    if (distance > 0 && distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best ? `${local}@${best}` : null
}
