"use client"

import posthog from "posthog-js"
import { useCallback } from "react"
import { useAuthDialog } from "@/components/auth/auth-dialog-provider"
import { useRequireVerified } from "@/components/auth/email-verification-provider"
import { pushClipProgress } from "@/components/clips/clip-progress"
import { toast } from "@/components/ui/toast"
import { useSession } from "@/lib/auth/session-provider"
import { writePendingClip } from "@/lib/clips/pending-clip"
import { trpc } from "@/lib/trpc/client"

interface CommitArgs {
  /** Source duration, to clamp the end. */
  duration: number
  end: number
  fileId: number
  /** Float seconds from the editor; rounded to whole-second bounds here. */
  start: number
  /** Source file title, shown in the render-progress card. */
  title?: string
}

/**
 * The one clip-commit flow, shared by the feed and the file dialog (ADR-0002 /
 * ADR-0003). Verified Members create immediately. Signed-out Users get their
 * draft parked and the auth modal thrown (the global replay commits it once they
 * sign up AND verify). Signed-in-but-unverified Users get the verify modal, and
 * the clip is created the moment they verify. Auth/verify modals are global —
 * the caller doesn't render anything.
 */
export function useClipCommit() {
  const { data: session } = useSession()
  const openAuth = useAuthDialog()
  const requireVerified = useRequireVerified()
  const utils = trpc.useUtils()
  const createClip = trpc.clips.create.useMutation()

  const commitClip = useCallback(
    (
      { fileId, start, end, duration, title }: CommitArgs,
      onCommitted: () => void
    ) => {
      const startSeconds = Math.max(0, Math.floor(start))
      const endSeconds = Math.min(Math.round(duration), Math.ceil(end))
      if (endSeconds <= startSeconds) {
        return
      }

      // Signed-out → park the draft + open the auth modal (taste-then-convert).
      if (!session?.user) {
        writePendingClip({ fileId, startSeconds, endSeconds })
        onCommitted()
        openAuth("signup")
        return
      }

      const runCreate = () =>
        createClip.mutate(
          { fileId, startSeconds, endSeconds },
          {
            onError: (e) => toast(e.message || "Couldn't add clip"),
            onSuccess: (clip) => {
              utils.invalidate()
              posthog.capture("clip_added", { file_id: fileId })
              // Hand off to the live render-progress card (download/view).
              if (clip) {
                pushClipProgress({
                  clipId: clip.id,
                  fileId: clip.fileId,
                  startSeconds: clip.startSeconds,
                  endSeconds: clip.endSeconds,
                  title,
                })
              }
              onCommitted()
            },
          }
        )

      // Verified → creates now; signed-in-but-unverified → pops the verify modal
      // and creates on success (the editor stays open behind it).
      requireVerified(runCreate)
    },
    [session, openAuth, createClip, utils, requireVerified]
  )

  return { commitClip, submitting: createClip.isPending }
}
