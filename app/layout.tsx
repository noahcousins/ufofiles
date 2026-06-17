import type { Metadata, Viewport } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { AppProviders } from "@/components/app-providers"
import { SiteFooter } from "@/components/site-footer"
import { getSession } from "@/lib/auth"
import { toClientSession } from "@/lib/auth/client-session"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "[ufo]files - Browse Government UFO & UAP Files",
  description:
    "Search, browse, and download released government files on UFOs, UAPs, sightings, reports, videos, and related documents.",
  keywords: [
    "UFO files",
    "UAP files",
    "government UFO files",
    "government UAP files",
    "declassified UFO documents",
    "UFO documents",
    "UAP documents",
    "unidentified anomalous phenomena",
    "unidentified aerial phenomena",
    "unidentified flying objects",
    "UFO sightings",
    "UAP sightings",
    "UFO videos",
    "UAP reports",
    "NASA UFO files",
    "FBI UFO files",
    "Department of State UFO files",
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read the session once, server-side, and seed the client store so the auth
  // UI renders correctly on first paint — no flash from a client-side fetch.
  // Narrow to the client-safe shape so the session token is never serialized
  // into the page HTML.
  const session = toClientSession(await getSession())

  return (
    <html
      className={cn(
        "overscroll-y-none overscroll-x-none antialiased",
        geist.variable,
        "font-sans",
        jetbrainsMono.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <AppProviders initialSession={session}>
          <div className="flex min-h-svh flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
