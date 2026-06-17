"use client"

import { TrashIcon } from "@phosphor-icons/react"
import { keepPreviousData } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import posthog from "posthog-js"
import { useMemo, useState } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import {
  FileCard,
  type FileItem,
  SkeletonCard,
} from "@/components/files/file-card"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { FilterPills } from "@/components/ui/filter-pills"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/lib/auth/session-provider"
import { trpc } from "@/lib/trpc/client"
import { ClipsPanel } from "./_components/clip-card"

type LibraryTab = "bookmarks" | "clips"

export default function LibraryPage() {
  const { data: session, isPending } = useSession()
  const [openId, setOpenId] = useState<number | null>(null)
  // `?tab` is URL-driven so the render-progress card's "View" link can deep-link
  // straight to the Clips tab (`/library?tab=clips&clip=<id>`).
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["bookmarks", "clips"] as const).withDefault(
      "bookmarks"
    )
  )

  const hasSession = Boolean(session)
  const library = trpc.library.list.useQuery(undefined, { enabled: hasSession })

  const bookmarks = library.data?.bookmarks ?? []
  const clips = library.data?.clips ?? []

  const fileIds = useMemo(() => {
    const ids = new Set<number>()
    for (const b of bookmarks) {
      ids.add(b.file.id)
    }
    for (const c of clips) {
      ids.add(c.file.id)
    }
    return [...ids]
  }, [bookmarks, clips])

  const { data: viewCounts } = trpc.telemetry.viewCounts.useQuery(
    { fileIds },
    {
      enabled: fileIds.length > 0,
      refetchInterval: 2 * 60 * 1000,
      placeholderData: keepPreviousData,
    }
  )

  const bookmarkFiles = bookmarks.map((b) => b.file)

  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono font-normal text-muted-foreground text-sm uppercase tracking-wide">
            Library
          </h1>
        </div>

        {isPending && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!(isPending || hasSession) && <AuthWall />}

        {!isPending && hasSession && (
          <>
            <div className="flex flex-wrap items-center gap-1 font-mono tracking-tighter">
              <FilterPills
                idPrefix="library-tab"
                onChange={(v) => {
                  setTab(v as LibraryTab)
                  posthog.capture("library_tab_changed", { tab: v })
                }}
                options={[
                  {
                    value: "bookmarks",
                    label: "Bookmarks",
                    count: bookmarks.length,
                  },
                  { value: "clips", label: "Clips", count: clips.length },
                ]}
                value={tab}
              />
            </div>

            <div className="pt-4">
              {tab === "bookmarks" &&
                (bookmarks.length === 0 ? (
                  <EmptyState text="No bookmarks yet. Tap Bookmark in the feed to save a file." />
                ) : (
                  <CardGrid>
                    {bookmarks.map((b, index) => (
                      <MarkCard
                        file={b.file}
                        files={bookmarkFiles}
                        index={index}
                        key={b.id}
                        openId={openId}
                        setOpenId={setOpenId}
                        viewData={viewCounts?.[b.file.id]}
                      />
                    ))}
                  </CardGrid>
                ))}

              {tab === "clips" &&
                (clips.length === 0 ? (
                  <EmptyState text="No clips yet. Mark a time range on a video to create one." />
                ) : (
                  <ClipsPanel clips={clips} />
                ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  )
}

function MarkCard({
  file,
  files,
  index,
  openId,
  setOpenId,
  viewData,
}: {
  file: FileItem
  files: FileItem[]
  index: number
  openId: number | null
  setOpenId: (id: number | null) => void
  viewData?: { hotScore: number; recentViews: number; views: number }
}) {
  const utils = trpc.useUtils()
  const removeBookmark = trpc.bookmarks.remove.useMutation({
    onSuccess: () => {
      utils.library.list.invalidate()
      utils.bookmarks.fileIds.invalidate()
    },
  })

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    posthog.capture("bookmark_removed", { file_id: file.id })
    removeBookmark.mutate({ fileId: file.id })
  }

  return (
    <div className="group relative">
      <FileCard
        currentIndex={index}
        file={file}
        isOpen={openId === file.id}
        nextFileId={index < files.length - 1 ? files[index + 1].id : null}
        onNavigate={(id) => setOpenId(id)}
        onOpenChange={(open) => setOpenId(open ? file.id : null)}
        prevFileId={index > 0 ? files[index - 1].id : null}
        totalFiles={files.length}
        viewData={viewData}
      />

      <button
        aria-label="Remove"
        className="absolute top-2 right-2 z-20 hidden size-7 items-center justify-center border border-border bg-background/90 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive group-hover:flex"
        disabled={removeBookmark.isPending}
        onClick={handleRemove}
        type="button"
      >
        {removeBookmark.isPending ? (
          <Spinner className="text-current" />
        ) : (
          <TrashIcon className="size-4" />
        )}
      </button>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border border-border border-dashed py-16 text-center">
      <p className="max-w-64 text-muted-foreground text-sm">{text}</p>
    </div>
  )
}

function AuthWall() {
  const openAuth = useAuthDialog()
  return (
    <div className="flex flex-col items-center gap-4 border border-border border-dashed py-20 text-center">
      <p className="max-w-xs text-muted-foreground text-sm">
        Sign in to view your library — your bookmarks and clips live here.
      </p>
      <Button onClick={() => openAuth("signin", "/library")} size="sm">
        Sign in
      </Button>
    </div>
  )
}
