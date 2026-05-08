import type { Metadata, Viewport } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { TRPCProvider } from "@/lib/trpc/provider"
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
  title: "[ufo]files",
  description:
    "Explore declassified files about UFOs, UAPs, and extraterrestrial life.",
  keywords: [
    "UFOs",
    "UAPs",
    "extraterrestrial life",
    "declassified files",
    "UFO files",
    "unidentified anomalous phenomena",
    "unidentified aerial phenomena",
    "unidentified flying objects",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
        <NuqsAdapter>
          <TRPCProvider>
            <ThemeProvider defaultTheme="dark">
              <div className="flex min-h-svh flex-col">
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
            </ThemeProvider>
          </TRPCProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
