import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Official UFO Files Release 03 | [ufo]files",
  description:
    "Official release of declassified UFO and UAP files from June 12, 2026.",
  openGraph: {
    title: "Official UFO Files Release 03 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from June 12, 2026.",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-03-og-image.jpg`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Official UFO Files Release 03 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from June 12, 2026.",
    images: [
      `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-03-og-image.jpg`,
    ],
  },
}

export default function Release3Page() {
  redirect("/?release=release-3")
}
