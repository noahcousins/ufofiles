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

export function proxy(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? ""

  if (isBot(ua) && request.nextUrl.searchParams.has("fileId")) {
    const response = NextResponse.next()
    response.headers.set("x-middleware-cache", "no-cache")
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/files/:path*"],
}
