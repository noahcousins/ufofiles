import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Release 2 | [ufo]files",
  description: "Official release of declassified UFO and UAP files.",
  openGraph: {
    title: "Release 2 | [ufo]files",
    description: "Official release of declassified UFO and UAP files.",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_WORKER_URL}/static/release-02-og-image.jpg`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Release 2 | [ufo]files",
    description: "Official release of declassified UFO and UAP files.",
    images: [
      `${process.env.NEXT_PUBLIC_WORKER_URL}/static/release-02-og-image.jpg`,
    ],
  },
}

export default function Release2Page() {
  redirect("/?release=release-2")
}
