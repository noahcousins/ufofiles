"use client"

import {
  ArrowCounterClockwise,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface EndCardProps {
  onShuffle: () => void
}

export function EndCard({ onShuffle }: EndCardProps) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-6 [scroll-snap-align:start] [scroll-snap-stop:always]">
      <div className="text-center">
        <p className="font-mono text-lg text-white">
          You&apos;ve seen all the videos
        </p>
        <p className="mt-1 font-mono text-sm text-white/50">
          That&apos;s every declassified video in the archive
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          className="gap-2"
          onClick={onShuffle}
          size="lg"
          variant="default"
        >
          <ArrowCounterClockwise className="size-4" />
          Shuffle &amp; restart
        </Button>
        <Link href="/">
          <Button className="w-full gap-2" size="lg" variant="outline">
            <MagnifyingGlassIcon className="size-4" />
            Browse all files
          </Button>
        </Link>
      </div>
    </div>
  )
}
