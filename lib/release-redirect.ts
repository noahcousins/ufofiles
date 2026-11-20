import { redirect } from "next/navigation"

export type ReleaseSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

// Release pages exist for share links and announcement emails, so the
// redirect must keep the incoming query (utm_* etc.) or attribution is lost.
export async function redirectToRelease(
  release: string,
  searchParams: ReleaseSearchParams
): Promise<never> {
  const params = new URLSearchParams({ release })
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key === "release" || value === undefined) {
      continue
    }
    for (const v of Array.isArray(value) ? value : [value]) {
      params.append(key, v)
    }
  }
  redirect(`/?${params}`)
}
