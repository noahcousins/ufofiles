import { redirect } from "next/navigation"

// The file browser now lives at the root (`/`). This preserves older
// `/files?...` links (filters, `?fileId`, `?release`) by forwarding the query.
export default async function FilesIndexRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      qs.set(key, value)
    } else if (Array.isArray(value)) {
      for (const v of value) {
        qs.append(key, v)
      }
    }
  }
  const query = qs.toString()
  redirect(query ? `/?${query}` : "/")
}
