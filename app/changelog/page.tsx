import type { Metadata } from "next"
import { MDXRemote } from "next-mdx-remote/rsc"
import { changelogMdxComponents } from "@/components/changelog/mdx-components"
import { Header } from "@/components/layout/header"
import { Separator } from "@/components/ui/separator"
import { getChangelogEntries } from "@/lib/changelog"

export const metadata: Metadata = {
  title: "Changelog - [ufo]files",
  description: "New features, improvements, and fixes for [ufo]files.",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatMonthDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export default function ChangelogPage() {
  const entries = getChangelogEntries()

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-12">
          <h1 className="font-mono text-xl tracking-tighter">Changelog</h1>
        </div>

        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No changelog entries yet.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute top-0 bottom-0 left-[5px] hidden w-px bg-border/40 md:block" />

            <div className="space-y-0">
              {entries.map((entry, i) => (
                <article key={entry.version}>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr] md:pl-10">
                    {/* Timeline dot */}
                    <div
                      className="absolute left-0 hidden size-[11px] rounded-full border-2 border-background bg-foreground/25 md:block"
                      style={{ marginTop: "5px" }}
                    />

                    {/* Left column — sticky metadata */}
                    <div className="md:sticky md:top-20 md:self-start">
                      <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-0.5">
                        <span className="font-mono text-foreground/70 text-xs">
                          v{entry.version}
                        </span>
                        <time className="font-mono text-[11px] text-muted-foreground/60">
                          {formatMonthDay(entry.date)}
                        </time>
                      </div>
                      <div className="mt-2 hidden flex-wrap gap-1 md:flex">
                        {entry.categories.map((cat) => (
                          <span
                            className="border border-border/30 px-1.5 py-px font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider"
                            key={cat}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right column — content */}
                    <div className="min-w-0">
                      <h2 className="mb-1 font-heading font-semibold text-base tracking-tight">
                        {entry.title}
                      </h2>
                      <time className="mb-4 block font-mono text-[11px] text-muted-foreground/60 md:hidden">
                        {formatDate(entry.date)}
                      </time>

                      {/* Mobile category badges */}
                      <div className="mb-3 flex flex-wrap gap-1 md:hidden">
                        {entry.categories.map((cat) => (
                          <span
                            className="border border-border/30 px-1.5 py-px font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider"
                            key={cat}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>

                      <div className="changelog-prose">
                        <MDXRemote
                          components={changelogMdxComponents}
                          source={entry.content}
                        />
                      </div>
                    </div>
                  </div>

                  {i < entries.length - 1 && (
                    <Separator className="my-12 md:ml-10" />
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
