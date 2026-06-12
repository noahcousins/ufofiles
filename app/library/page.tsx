"use client"

import {
  BookmarkSimpleIcon,
  FilmSlateIcon,
  FolderSimpleIcon,
  SignOutIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { keepPreviousData } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isMember, signOut, useSession } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { FileCard, type FileItem, SkeletonCard } from "../files/file-card"

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function LibraryPage() {
  const { data: session, isPending } = useSession()
  const [authOpen, setAuthOpen] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const hasSession = Boolean(session)
  const library = trpc.library.list.useQuery(undefined, { enabled: hasSession })
  const collections = trpc.collections.list.useQuery(undefined, {
    enabled: hasSession,
  })

  const bookmarks = library.data?.bookmarks ?? []
  const clips = library.data?.clips ?? []
  const member = isMember(session?.user)

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
  const clipFiles = clips.map((c) => c.file)

  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-semibold text-lg">Library</h1>
          <AccountControl
            member={member}
            onUpgrade={() => setAuthOpen(true)}
            session={session}
          />
        </div>

        {isPending && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!(isPending || hasSession) && (
          <EmptyState text="You haven't marked anything yet. Bookmark a file in the feed and it'll show up here." />
        )}

        {!isPending && hasSession && (
          <Tabs defaultValue="bookmarks">
            <TabsList>
              <TabsTrigger value="bookmarks">
                <BookmarkSimpleIcon className="size-4" />
                Bookmarks ({bookmarks.length})
              </TabsTrigger>
              <TabsTrigger value="clips">
                <FilmSlateIcon className="size-4" />
                Clips ({clips.length})
              </TabsTrigger>
              <TabsTrigger value="collections">
                <FolderSimpleIcon className="size-4" />
                Collections ({collections.data?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent className="pt-4" value="bookmarks">
              {bookmarks.length === 0 ? (
                <EmptyState text="No bookmarks yet. Tap Bookmark in the feed to save a file." />
              ) : (
                <CardGrid>
                  {bookmarks.map((b, index) => (
                    <MarkCard
                      file={b.file}
                      files={bookmarkFiles}
                      index={index}
                      key={b.id}
                      markId={b.id}
                      openId={openId}
                      setOpenId={setOpenId}
                      type="bookmark"
                      viewData={viewCounts?.[b.file.id]}
                    />
                  ))}
                </CardGrid>
              )}
            </TabsContent>

            <TabsContent className="pt-4" value="clips">
              {clips.length === 0 ? (
                <EmptyState text="No clips yet. Mark a time range on a video to create one." />
              ) : (
                <CardGrid>
                  {clips.map((c, index) => (
                    <MarkCard
                      badge={`${formatTime(c.startSeconds)}–${formatTime(c.endSeconds)}`}
                      file={c.file}
                      files={clipFiles}
                      index={index}
                      key={c.id}
                      markId={c.id}
                      openId={openId}
                      setOpenId={setOpenId}
                      type="clip"
                      viewData={viewCounts?.[c.file.id]}
                    />
                  ))}
                </CardGrid>
              )}
            </TabsContent>

            <TabsContent className="pt-4" value="collections">
              <CollectionsPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AuthDialog onOpenChange={setAuthOpen} open={authOpen} />
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
  markId,
  type,
  viewData,
  badge,
}: {
  file: FileItem
  files: FileItem[]
  index: number
  openId: number | null
  setOpenId: (id: number | null) => void
  markId: number
  type: "bookmark" | "clip"
  viewData?: { hotScore: number; recentViews: number; views: number }
  badge?: string
}) {
  const utils = trpc.useUtils()
  const onRemoved = () => {
    utils.library.list.invalidate()
    if (type === "bookmark") {
      utils.bookmarks.fileIds.invalidate()
    }
  }
  const removeBookmark = trpc.bookmarks.remove.useMutation({
    onSuccess: onRemoved,
  })
  const removeClip = trpc.clips.remove.useMutation({ onSuccess: onRemoved })
  const pending = removeBookmark.isPending || removeClip.isPending

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (type === "bookmark") {
      removeBookmark.mutate({ fileId: file.id })
    } else {
      removeClip.mutate({ id: markId })
    }
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

      {badge && (
        <span className="pointer-events-none absolute top-2 left-2 z-20 border border-border bg-background/90 px-1.5 py-0.5 font-mono text-[10px] backdrop-blur-sm">
          {badge}
        </span>
      )}

      <button
        aria-label="Remove"
        className="absolute top-2 right-2 z-20 hidden size-7 items-center justify-center border border-border bg-background/90 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive group-hover:flex"
        disabled={pending}
        onClick={handleRemove}
        type="button"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  )
}

function AccountControl({
  member,
  session,
  onUpgrade,
}: {
  member: boolean
  session: ReturnType<typeof useSession>["data"]
  onUpgrade: () => void
}) {
  const utils = trpc.useUtils()
  const handleSignOut = async () => {
    await signOut()
    await utils.invalidate()
  }

  if (member && session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {session.user.email}
        </span>
        <Button onClick={handleSignOut} size="sm" variant="ghost">
          <SignOutIcon className="size-4" />
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {session && (
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
          Guest
        </span>
      )}
      <Button onClick={onUpgrade} size="sm">
        Sign in to save &amp; export
      </Button>
    </div>
  )
}

function CollectionsPanel() {
  const utils = trpc.useUtils()
  const collections = trpc.collections.list.useQuery()
  const [name, setName] = useState("")
  const create = trpc.collections.create.useMutation({
    onSuccess: () => {
      setName("")
      utils.collections.list.invalidate()
    },
  })
  const remove = trpc.collections.remove.useMutation({
    onSuccess: () => utils.collections.list.invalidate(),
  })

  return (
    <div>
      <form
        className="mb-4 flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) {
            create.mutate({ name: name.trim() })
          }
        }}
      >
        <input
          className="h-8 w-full border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring"
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          value={name}
        />
        <Button disabled={create.isPending} size="sm" type="submit">
          Add
        </Button>
      </form>

      {(collections.data?.length ?? 0) === 0 ? (
        <EmptyState text="No collections. Group your marks into named sets." />
      ) : (
        <ul className="flex flex-col divide-y divide-border border border-border">
          {collections.data?.map((c) => (
            <li
              className="flex items-center justify-between px-3 py-2.5"
              key={c.id}
            >
              <span className="flex items-center gap-2 text-sm">
                <FolderSimpleIcon className="size-4 text-muted-foreground" />
                {c.name}
                <span className="text-muted-foreground text-xs">
                  {c.markCount} {c.markCount === 1 ? "mark" : "marks"}
                </span>
              </span>
              <button
                aria-label="Delete collection"
                className="text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => remove.mutate({ id: c.id })}
                type="button"
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border border-border border-dashed py-16 text-center">
      <p className="max-w-xs text-muted-foreground text-sm">{text}</p>
    </div>
  )
}
