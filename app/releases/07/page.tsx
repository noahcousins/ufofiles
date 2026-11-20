import type { Metadata } from "next"
import {
  type ReleaseSearchParams,
  redirectToRelease,
} from "@/lib/release-redirect"

export const metadata: Metadata = {
  title: "Official UFO Files Release 07 | [ufo]files",
  description:
    "Official release of declassified UFO and UAP files from October 23, 2026.",
  openGraph: {
    title: "Official UFO Files Release 07 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from October 23, 2026.",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-07-og-image.jpg`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Official UFO Files Release 07 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from October 23, 2026.",
    images: [
      `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-07-og-image.jpg`,
    ],
  },
}

export default async function Release7Page({
  searchParams,
}: {
  searchParams: ReleaseSearchParams
}) {
  await redirectToRelease("release-7", searchParams)
}
