"use client"

import { useEffect, useRef } from "react"
import { pushClipProgress } from "@/components/clips/clip-progress"
import { useSession } from "@/lib/auth/session-provider"
import { isMember } from "@/lib/auth-client"
import { clearPendingClip, readPendingClip } from "@/lib/clips/pending-clip"
import { trpc } from "@/lib/trpc/client"

/**
 * Mounted once, globally (TRPCProvider). Watches the session; the moment it
 * becomes a Member, it commits any parked Clip draft (ADR-0003 taste-then-
 * convert) and clears it. This is the single replay point that covers all auth
 * flows, since every one of them navigates and lands somewhere fresh.
 */
export function PendingClipReplay() {
  const { data: session } = useSession()
  const utils = trpc.useUtils()
  const create = trpc.clips.create.useMutation()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !isMember(session?.user)) {
      return
    }
    const pending = readPendingClip()
    if (!pending) {
      return
    }
    // Latch before mutating so a re-render / StrictMode re-run can't double-fire.
    fired.current = true
    create.mutate(
      {
        fileId: pending.fileId,
        startSeconds: pending.startSeconds,
        endSeconds: pending.endSeconds,
      },
      {
        onSuccess: (clip) => {
          clearPendingClip()
          utils.invalidate()
          if (clip) {
            pushClipProgress({
              clipId: clip.id,
              fileId: clip.fileId,
              startSeconds: clip.startSeconds,
              endSeconds: clip.endSeconds,
            })
          }
        },
        onError: () => {
          // Don't strand a poison draft across reloads.
          clearPendingClip()
        },
      }
    )
  }, [session, create, utils])

  return null
}
