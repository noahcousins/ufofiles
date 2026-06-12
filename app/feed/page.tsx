import { redirect } from "next/navigation"

// The feed now lives at the root. Preserve older `/feed?v=<id>` share links.
export default async function FeedRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const v = typeof params.v === "string" ? params.v : undefined
  redirect(v ? `/?v=${encodeURIComponent(v)}` : "/")
}
