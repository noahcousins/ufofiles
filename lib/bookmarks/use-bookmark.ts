"use client"

import { useCallback } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { useRequireVerified } from "@/components/auth/email-verification-provider"
import { useSession } from "@/lib/auth/session-provider"
import { trpc } from "@/lib/trpc/client"

/**
 * Bookmark toggle state + actions for a single File, shared by the watch feed
 * and the file browser. Bookmarking requires a verified account: signed out →
 * `toggle()` opens the global auth modal; signed-in-but-unverified → the verify
 * modal pops and the toggle runs once verified. Analytics live in the caller.
 */
export function useBookmark(fileId: number) {
  const { data: session } = useSession()
  const openAuth = useAuthDialog()
  const requireVerified = useRequireVerified()
  const utils = trpc.useUtils()

  const bookmarkedIds = trpc.bookmarks.fileIds.useQuery(undefined, {
    enabled: Boolean(session),
  })
  const isBookmarked = bookmarkedIds.data?.includes(fileId) ?? false

  // Aggregate count across all users — public, cached.
  const bookmarkCounts = trpc.bookmarks.counts.useQuery(
    { fileIds: [fileId] },
    { staleTime: 60 * 1000 }
  )
  const bookmarkCount = bookmarkCounts.data?.[fileId] ?? 0

  // Optimistic toggle: flip the `fileIds` membership (drives the filled/outline
  // icon) and nudge the count immediately, snapshotting both so we can roll back
  // if the mutation fails. `onSettled` reconciles the toggle with server truth.
  const applyOptimistic = async (next: boolean) => {
    await Promise.all([
      utils.bookmarks.fileIds.cancel(),
      utils.bookmarks.counts.cancel({ fileIds: [fileId] }),
    ])
    const prevIds = utils.bookmarks.fileIds.getData()
    const prevCounts = utils.bookmarks.counts.getData({ fileIds: [fileId] })
    utils.bookmarks.fileIds.setData(undefined, (old) => {
      const ids = new Set(old ?? [])
      if (next) {
        ids.add(fileId)
      } else {
        ids.delete(fileId)
      }
      return [...ids]
    })
    utils.bookmarks.counts.setData({ fileIds: [fileId] }, (old) => ({
      ...old,
      [fileId]: Math.max(0, (old?.[fileId] ?? 0) + (next ? 1 : -1)),
    }))
    return { prevIds, prevCounts }
  }

  const rollback = (ctx?: {
    prevCounts?: Record<number, number>
    prevIds?: number[]
  }) => {
    if (ctx?.prevIds) {
      utils.bookmarks.fileIds.setData(undefined, ctx.prevIds)
    }
    utils.bookmarks.counts.setData({ fileIds: [fileId] }, ctx?.prevCounts)
  }

  const createBookmark = trpc.bookmarks.create.useMutation({
    onMutate: () => applyOptimistic(true),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => utils.bookmarks.fileIds.invalidate(),
  })
  const removeBookmark = trpc.bookmarks.remove.useMutation({
    onMutate: () => applyOptimistic(false),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => utils.bookmarks.fileIds.invalidate(),
  })
  const mutating = createBookmark.isPending || removeBookmark.isPending

  const toggle = useCallback(() => {
    if (mutating) {
      return
    }
    if (!session) {
      openAuth("signup")
      return
    }
    const run = () => {
      if (isBookmarked) {
        removeBookmark.mutate({ fileId })
      } else {
        createBookmark.mutate({ fileId })
      }
    }
    // Verified → runs now; unverified → pops the verify modal, runs on success.
    requireVerified(run)
  }, [
    fileId,
    isBookmarked,
    mutating,
    session,
    openAuth,
    createBookmark,
    removeBookmark,
    requireVerified,
  ])

  return {
    bookmarkCount,
    isBookmarked,
    mutating,
    toggle,
  }
}
