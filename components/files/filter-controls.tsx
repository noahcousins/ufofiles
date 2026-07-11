"use client"

import { CaretDown } from "@phosphor-icons/react/dist/ssr"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Filter primitives shared by the file browser's filters and the watch feed's
// filter drawer. Keep this module free of browser- or feed-specific state so
// each consumer only changes for its own reasons.

const AGENCY_SEALS: Record<string, string> = {
  FBI: "/img/FBI-Seal.png",
  "Department of War": "/img/DOW-Seal.png",
  "Department of State": "/img/DOS-Seal.png",
  "Department of Energy": "/img/DOE-Seal.png",
  "Central Intelligence Agency": "/img/CIA-Seal.png",
  "Office of the Director of National Intelligence": "/img/ODNI-Seal.png",
  NASA: "/img/NASA-Insignia.png",
}

export const DATE_RANGE_LABELS: Record<string, string> = {
  "2010-now": "2010+",
  "2000s": "2000s",
  "1960-2000": "1960-2000",
  "pre-1960": "Pre-1960",
}

export const DATE_RANGE_ORDER = [
  "2010-now",
  "2000s",
  "1960-2000",
  "pre-1960",
] as const

export type DateRange = (typeof DATE_RANGE_ORDER)[number]

export const TAG_CATEGORY_ORDER = [
  "phenomenon",
  "document-type",
  "content",
  "resolution",
] as const

export const TAG_CATEGORY_LABELS: Record<string, string> = {
  phenomenon: "Phenomenon",
  "document-type": "Document Type",
  content: "Content",
  resolution: "Resolution",
}

export interface ReleaseInfo {
  fileCount: number
  id: number
  name: string
  releaseDate: string | null
  title: string
}

export interface TagInfo {
  category: string
  count: number
  label: string
  slug: string
}

/**
 * Toggle `slug` within a comma-separated tag URL param. Returns the next param
 * value (null when no tags remain) and whether the tag was added, so callers
 * can fire their "tag applied" analytics only on add.
 */
export function toggleTagParam(currentCsv: string, slug: string) {
  const current = currentCsv ? currentCsv.split(",") : []
  const added = !current.includes(slug)
  const next = added ? [...current, slug] : current.filter((t) => t !== slug)
  return { added, value: next.length > 0 ? next.join(",") : null }
}

export function AgencySeal({ agency }: { agency: string }) {
  const src = AGENCY_SEALS[agency] ?? "/img/US-Flag.png"
  return (
    <Image
      alt={`${agency} seal`}
      className="size-6 shrink-0 rounded-full object-contain"
      height={48}
      src={src}
      width={48}
    />
  )
}

export function AccordionSection({
  title,
  children,
  open,
  onToggle,
}: {
  title: string
  children: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-1.5 font-medium font-sans text-muted-foreground text-xs tracking-normal hover:text-foreground"
        onClick={onToggle}
        type="button"
      >
        {title}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <CaretDown className="size-3" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <div className="mt-2 flex flex-wrap gap-1.5 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AgencySelect({
  agency,
  agencies,
  onAgencyChange,
  mobile,
}: {
  agency: string
  agencies: string[]
  onAgencyChange: (value: string | null) => void
  mobile?: boolean
}) {
  return (
    <Select
      modal={false}
      onValueChange={(val) => onAgencyChange(val === "all" ? null : val)}
      value={agency || "all"}
    >
      <SelectTrigger
        className={
          mobile
            ? "w-full text-[16px] data-[size=default]:h-12"
            : "w-full text-sm data-[size=default]:h-9"
        }
      >
        <SelectValue>
          {agency ? (
            <>
              <AgencySeal agency={agency} />
              {agency}
            </>
          ) : (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center">
                <Image
                  alt="US Flag"
                  className="size-4 object-contain"
                  height={48}
                  src="/img/US-Flag.png"
                  width={48}
                />
              </span>
              All agencies
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="all">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Image
              alt="US Flag"
              className="size-4 object-contain"
              height={48}
              src="/img/US-Flag.png"
              width={48}
            />
          </span>
          All agencies
        </SelectItem>
        {agencies.map((a) => (
          <SelectItem key={a} value={a}>
            <AgencySeal agency={a} />
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ReleaseSelect({
  release,
  releases,
  releaseCounts,
  onReleaseChange,
  isReleaseNew = () => false,
  hasNewRelease = false,
  seenNewestRelease = true,
  markReleaseSeen,
  mobile,
}: {
  release: string
  releases: ReleaseInfo[]
  releaseCounts?: Record<number, number>
  onReleaseChange: (value: string | null) => void
  // The "new release" affordance (ping dot + badge) — omit all four where it
  // isn't shown, e.g. the watch feed's drawer.
  isReleaseNew?: (r: ReleaseInfo) => boolean
  hasNewRelease?: boolean
  seenNewestRelease?: boolean
  markReleaseSeen?: () => void
  mobile?: boolean
}) {
  return (
    <Select
      modal={false}
      onValueChange={(val) => {
        onReleaseChange(val === "all" ? null : val)
        const selected = releases.find((r) => r.name === val)
        if (selected && isReleaseNew(selected)) {
          markReleaseSeen?.()
        }
      }}
      value={release || "all"}
    >
      <SelectTrigger
        className={
          mobile
            ? "w-full text-[16px] data-[size=default]:h-12"
            : "w-full text-sm data-[size=default]:h-9"
        }
      >
        {hasNewRelease && !seenNewestRelease && (
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ring opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-ring" />
          </span>
        )}
        <SelectValue>
          {release
            ? (releases.find((r) => r.name === release)?.title ?? release)
            : "All releases"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value="all">All releases</SelectItem>
        {releases.map((r) => (
          <SelectItem key={r.name} value={r.name}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {isReleaseNew(r) && !seenNewestRelease && (
                  <span className="relative flex size-1.5 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ring opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-ring" />
                  </span>
                )}
                {r.title}
              </span>
              <span className="flex items-center gap-1.5">
                {isReleaseNew(r) && (
                  <Badge
                    className="bg-primary! px-1 py-0 text-[10px] text-primary-foreground! uppercase"
                    variant="default"
                  >
                    New
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {releaseCounts ? (releaseCounts[r.id] ?? 0) : r.fileCount}
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
