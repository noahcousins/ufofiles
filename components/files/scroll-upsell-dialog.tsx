"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { getStaticAssetUrl } from "@/lib/file-url"
import { cn } from "@/lib/utils"

interface ScrollUpsellDialogProps {
  onLogIn: () => void
  onOpenChange: (open: boolean) => void
  onSignUp: () => void
  open: boolean
  /** How many more files match the current filters beyond what's loaded. */
  remaining: number | null
}

/**
 * The "keep scrolling" gate for guests. A pitch first, form second: the
 * backdrop is a mosaic of real file thumbnails (so the modal shows the
 * archive, not a gradient), and the CTA hands off to the global auth dialog.
 * The mosaic is one pre-composed webp in R2, built by
 * scripts/generate-upsell-mosaic.ts, rather than dozens of live thumbnails.
 */
export function ScrollUpsellDialog({
  onLogIn,
  onOpenChange,
  onSignUp,
  open,
  remaining,
}: ScrollUpsellDialogProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-opacity data-[starting-style]:transition-opacity" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[34rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-border bg-background shadow-2xl outline-none",
            "data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:transition-all data-[starting-style]:transition-all"
          )}
        >
          <Mosaic />

          <div className="relative flex flex-col items-center px-8 pt-16 pb-10 text-center sm:px-14">
            <Logo className="h-8 w-auto text-foreground" />
            <Dialog.Title className="mt-6 font-semibold text-4xl text-foreground tracking-tight">
              Unlimited access
            </Dialog.Title>
            <Dialog.Description className="mt-4 max-w-[26rem] text-balance text-lg text-muted-foreground leading-relaxed">
              {remaining && remaining > 0
                ? `${remaining.toLocaleString()} more files match your search. Create a free account to keep browsing the full archive, and save files and clips to your library.`
                : "Create a free account to keep browsing the full archive, and save files and clips to your library."}
            </Dialog.Description>
            <Button
              className="mt-10 h-12 w-full font-semibold text-base"
              onClick={onSignUp}
              size="lg"
            >
              Sign up free
            </Button>
            <p className="mt-5 text-muted-foreground text-sm">
              Already have an account?{" "}
              <button
                className="font-medium text-foreground underline-offset-2 hover:underline"
                onClick={onLogIn}
                type="button"
              >
                Log in
              </button>
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Full-bleed collage behind the copy. Slightly rotated and over-scaled so
 * the tile edges never line up with the dialog edges, then faded to the
 * background so the text stays legible.
 */
function Mosaic() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 origin-center rotate-[-6deg] scale-[1.35] bg-center bg-cover opacity-60"
        style={{
          backgroundImage: `url(${getStaticAssetUrl("upsell-mosaic.webp")})`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/92 to-background" />
    </div>
  )
}
