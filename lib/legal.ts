import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const LEGAL_DIR = path.join(process.cwd(), "content/legal")

export interface LegalDoc {
  content: string
  title: string
  updated: string
}

/** Load a legal MDX doc (`content/legal/<slug>.mdx`), or null if missing. */
export function getLegalDoc(slug: string): LegalDoc | null {
  const file = path.join(LEGAL_DIR, `${slug}.mdx`)
  if (!fs.existsSync(file)) {
    return null
  }
  const raw = fs.readFileSync(file, "utf-8")
  const { data, content } = matter(raw)
  return {
    title: data.title as string,
    updated: data.updated as string,
    content,
  }
}
