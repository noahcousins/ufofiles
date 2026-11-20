import type { Metadata } from "next"
import {
  type ReleaseSearchParams,
  redirectToRelease,
} from "@/lib/release-redirect"

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
        url: `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-03-og-image-v2.jpg`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Official UFO Files Release 03 | [ufo]files",
    description:
      "Official release of declassified UFO and UAP files from June 12, 2026.",
    images: [
      `${process.env.NEXT_PUBLIC_WORKER_URL}/assets/static/release-03-og-image-v2.jpg`,
    ],
  },
}

export default async function Release3Page({
  searchParams,
}: {
  searchParams: ReleaseSearchParams
}) {
  await redirectToRelease("release-3", searchParams)
}
