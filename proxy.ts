import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"
import {
  CONSENT_REQUIRED_COOKIE,
  countryFromHeaders,
  isConsentRequiredCountry,
} from "@/lib/consent/geo"

const BOT_PATTERNS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "WhatsApp",
  "Discordbot",
  "TelegramBot",
]

function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some((pattern) => userAgent.includes(pattern))
}

// Member-only areas. Logged-out visitors are bounced to the sign-in modal route
// with a `?redirect=` back here. This is an optimistic cookie-presence check
// (no DB hit); server components and tRPC still enforce membership.
const PROTECTED_PREFIXES = ["/library", "/account"]

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function stampConsentRegion(request: NextRequest, response: NextResponse) {
  const required = isConsentRequiredCountry(countryFromHeaders(request.headers))
  response.cookies.set(CONSENT_REQUIRED_COOKIE, required ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  })
}

export function proxy(request: NextRequest) {
  const { nextUrl } = request
  const ua = request.headers.get("user-agent") ?? ""

  if (isProtected(nextUrl.pathname)) {
    const sessionCookie = getSessionCookie(request, {
      cookiePrefix: "ufofiles",
    })
    if (!sessionCookie) {
      const loginUrl = new URL("/login", nextUrl)
      loginUrl.searchParams.set("redirect", nextUrl.pathname + nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  const response = NextResponse.next()
  if (isBot(ua) && nextUrl.searchParams.has("fileId")) {
    response.headers.set("x-middleware-cache", "no-cache")
  }
  stampConsentRegion(request, response)
  return response
}

export const config = {
  matcher: [
    "/((?!api|ingest|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
}
