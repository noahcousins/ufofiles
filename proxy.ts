import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

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

export function proxy(request: NextRequest) {
  const { nextUrl } = request
  const ua = request.headers.get("user-agent") ?? ""

  if (isBot(ua) && nextUrl.searchParams.has("fileId")) {
    const response = NextResponse.next()
    response.headers.set("x-middleware-cache", "no-cache")
    return response
  }

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

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/files/:path*",
    "/library",
    "/library/:path*",
    "/account",
    "/account/:path*",
  ],
}
