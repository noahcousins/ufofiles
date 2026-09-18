import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Official UFO Files Release 06 | [ufo]files",
  description:
    "Official release of declassified UFO and UAP files from September 18, 2026.",
  openGraph: {
    title: "Official UFO Files Release 06 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from September 18, 2026.",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-06-og-image.jpg`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Official UFO Files Release 06 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from September 18, 2026.",
    images: [
      `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-06-og-image.jpg`,
    ],
  },
}

export default function Release6Page() {
  redirect("/?release=release-6")
}
