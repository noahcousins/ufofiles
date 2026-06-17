import type { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Not found - [ufo]files",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex min-h-[70svh] flex-1 flex-col items-center justify-center gap-7 px-4">
      <div className="flex items-center gap-5">
        <span className="font-mono font-semibold text-5xl tracking-tighter">
          404
        </span>
        <span className="h-12 w-px bg-border" />
        <p className="max-w-xs text-balance text-muted-foreground text-sm leading-relaxed">
          We couldn&apos;t find that file. It may have been removed, or the link
          is wrong.
        </p>
      </div>
      <Link className={cn(buttonVariants({ size: "lg" }))} href="/">
        Browse the archive
      </Link>
    </div>
  )
}
