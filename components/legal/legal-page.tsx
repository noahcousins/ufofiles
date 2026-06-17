import { notFound } from "next/navigation"
import { MDXRemote } from "next-mdx-remote/rsc"
import { Header } from "@/components/layout/header"
import { getLegalDoc } from "@/lib/legal"
import { legalMdxComponents } from "./mdx-components"

/** Shared shell for legal docs (privacy, terms) sourced from content/legal. */
export function LegalPage({ slug }: { slug: string }) {
  const doc = getLegalDoc(slug)
  if (!doc) {
    notFound()
  }

  return (
    <>
      <Header />
      <article className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-semibold text-2xl tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-muted-foreground text-xs">
          Last updated: {doc.updated}
        </p>

        <div className="mt-6">
          <MDXRemote components={legalMdxComponents} source={doc.content} />
        </div>
      </article>
    </>
  )
}
