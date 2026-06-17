"use client"

import { CheckToggle } from "@/components/ui/check-toggle"
import { trpc } from "@/lib/trpc/client"

/**
 * Explicit email-marketing opt-in. This is a real, specific permission to send
 * product emails, separate from cookie/analytics consent (the banner) and from
 * transactional mail (sign-in links, password resets), which always send.
 */
export function EmailPreferences() {
  const utils = trpc.useUtils()
  const pref = trpc.marketing.get.useQuery()
  const setConsent = trpc.marketing.setConsent.useMutation({
    // Optimistic: flip the toggle immediately, roll back if the save fails.
    onMutate: async ({ consent }) => {
      await utils.marketing.get.cancel()
      const prev = utils.marketing.get.getData()
      utils.marketing.get.setData(undefined, { consent })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        utils.marketing.get.setData(undefined, ctx.prev)
      }
    },
    onSettled: () => utils.marketing.get.invalidate(),
  })

  // Opt-out model: default subscribed while the value loads.
  const consent = pref.data?.consent ?? true
  const busy = pref.isLoading || setConsent.isPending

  return (
    <section className="border border-border bg-card">
      <div className="border-border border-b px-4 py-3">
        <h2 className="font-medium text-sm">Preferences</h2>
      </div>
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="font-medium text-xs">Product updates</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Occasional emails about new releases and features. Opt out anytime,
            this never affects sign-in or account emails.
          </p>
        </div>
        <CheckToggle
          checked={consent}
          disabled={busy}
          label="Product update emails"
          onChange={(next) => setConsent.mutate({ consent: next })}
        />
      </div>
    </section>
  )
}
