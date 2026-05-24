"use client"

import { ArrowLeftIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { Logo } from "@/components/ui/logo"

export function FeedHeader() {
  return (
    <div className="absolute inset-x-0 top-0 z-40">
      <div className="bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            aria-label="Back to files"
            className="flex size-8 items-center justify-center text-white/80 transition-colors hover:text-white"
            href="/"
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
          <Logo className="h-3" />
          <div className="size-8" />
        </div>
      </div>
    </div>
  )
}
