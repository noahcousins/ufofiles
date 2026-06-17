"use client"

import { Hash } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import { AgencySeal } from "@/components/files/file-filters"
import type { FeedItem } from "./video-panel"

interface VideoMetadataProps {
  item: FeedItem
  scrubbing?: boolean
  tooltipText?: string | null
}

export function VideoMetadata({
  item,
  scrubbing,
  tooltipText,
}: VideoMetadataProps) {
  return (
    <motion.div
      animate={{ y: scrubbing ? -14 : 0 }}
      className="absolute right-0 bottom-10 left-0 z-20"
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <div className="pointer-events-none absolute inset-0 -bottom-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="relative max-w-[75%] px-4">
        <AnimatePresence>
          {tooltipText && (
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mb-1.5 font-mono text-[11px] text-white/90 leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
              exit={{ opacity: 0, y: 4 }}
              initial={{ opacity: 0, y: 4 }}
              key="tooltip"
              transition={{ duration: 0.15 }}
            >
              {tooltipText}
            </motion.p>
          )}
        </AnimatePresence>
        <h2 className="line-clamp-2 font-medium text-sm text-white leading-snug [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
          {item.title}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {item.agency && (
            <a
              className="flex items-center gap-1.5 font-mono text-[11px] text-white/70 hover:text-white"
              href={`/?agency=${encodeURIComponent(item.agency)}`}
              onClick={(e) => e.stopPropagation()}
            >
              <AgencySeal agency={item.agency} />
              {item.agency}
            </a>
          )}
          {item.incidentDate && item.incidentDate !== "N/A" && (
            <span className="font-mono text-[11px] text-white/60">
              {item.incidentDate}
            </span>
          )}
          {item.incidentLocation && item.incidentLocation !== "N/A" && (
            <span className="font-mono text-[11px] text-white/60">
              {item.incidentLocation}
            </span>
          )}
        </div>
        {item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <a
                className="flex items-center gap-0.5 rounded-none bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
                href={`/?tag=${encodeURIComponent(tag.slug)}`}
                key={tag.slug}
                onClick={(e) => e.stopPropagation()}
              >
                <Hash className="size-2.5" weight="bold" />
                {tag.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
