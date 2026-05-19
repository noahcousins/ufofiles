import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

export type ChangelogCategory = "feature" | "fix" | "improvement" | "breaking"

export interface ChangelogEntry {
  categories: ChangelogCategory[]
  content: string
  date: string
  title: string
  version: string
}

const CHANGELOG_DIR = path.join(process.cwd(), "content/changelog")

export function getChangelogEntries(): ChangelogEntry[] {
  if (!fs.existsSync(CHANGELOG_DIR)) {
    return []
  }

  const files = fs.readdirSync(CHANGELOG_DIR).filter((f) => f.endsWith(".mdx"))

  const entries = files.map((filename) => {
    const raw = fs.readFileSync(path.join(CHANGELOG_DIR, filename), "utf-8")
    const { data, content } = matter(raw)

    return {
      version: data.version as string,
      date: data.date as string,
      title: data.title as string,
      categories: (data.categories ?? []) as ChangelogCategory[],
      content,
    }
  })

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}
