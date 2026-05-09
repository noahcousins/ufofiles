"use client"

import { DownloadSimpleIcon } from "@phosphor-icons/react"
import {
  Archive,
  BracketsCurly,
  FilePdf,
  Image,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr"
import { SiteHeader } from "@/app/files/site-header"
import { Badge } from "@/components/ui/badge"
import { getFileUrl } from "@/lib/file-url"
import { trpc } from "@/lib/trpc/client"
import { formatFileSize } from "@/lib/utils"

const SLUG_ICONS: Record<string, React.ElementType> = {
  master: Archive,
  images: Image,
  pdfs: FilePdf,
  videos: VideoCamera,
  json: BracketsCurly,
}

const SLUG_COLORS: Record<string, string> = {
  master: "text-foreground border-foreground/20 bg-foreground/5",
  images: "text-green-400 border-green-400/20 bg-green-400/5",
  pdfs: "text-red-400 border-red-400/20 bg-red-400/5",
  videos: "text-blue-400 border-blue-400/20 bg-blue-400/5",
  json: "text-amber-400 border-amber-400/20 bg-amber-400/5",
}

export function ReleasesPage() {
  const [data] = trpc.releases.downloads.useSuspenseQuery()

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading font-semibold text-2xl tracking-tight">
            Releases
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Download complete release archives for offline access.
          </p>
        </div>

        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No releases available yet.
          </p>
        ) : (
          <div className="space-y-12">
            {data.map((release) => (
              <section key={release.id}>
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="font-medium font-mono text-lg tracking-tighter">
                      {release.title}
                    </h2>
                    {release.releaseDate && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {release.releaseDate}
                      </Badge>
                    )}
                  </div>
                  {release.description && (
                    <p className="mt-1 text-muted-foreground text-sm">
                      {release.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {release.releaseDownloads.map((dl) => {
                    const Icon = SLUG_ICONS[dl.slug] ?? Archive
                    const colorClass =
                      SLUG_COLORS[dl.slug] ?? SLUG_COLORS.master

                    return (
                      <a
                        key={dl.id}
                        href={getFileUrl(dl.r2Key)}
                        download
                        className={`group flex items-center gap-4 border p-4 transition-colors hover:bg-muted/30 ${
                          dl.slug === "master"
                            ? "border-foreground/15 bg-foreground/[0.02]"
                            : "border-border"
                        }`}
                      >
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center border ${colorClass}`}
                        >
                          <Icon className="size-5" weight="duotone" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">{dl.label}</div>
                          <div className="mt-0.5 font-mono text-muted-foreground text-xs">
                            {formatFileSize(dl.fileSize)} .zip
                          </div>
                        </div>
                        <div className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          <DownloadSimpleIcon className="size-4 text-muted-foreground hover:text-foreground" />
                        </div>
                      </a>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
