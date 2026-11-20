"use client"

import { getFileUrl } from "@/lib/file-url"

interface PdfManifestEntry {
  basePath: string
  pages: number
}

type PdfManifest = Record<string, PdfManifestEntry>

const KNOWN_RELEASES = [
  "release-1",
  "release-2",
  "release-3",
  "release-4",
  "release-5",
  "release-6",
  "release-7",
  "release-8",
  // Historical (pre-PURSUE) releases
  "1949-project-grudge",
  "1952-pentagon-press-conference",
  "1955-blue-book-special-report-14",
  "1969-blue-book-closure",
  "fbi-ufo-foia",
  "cia-ufo-foia",
  "nsa-ufo-foia",
  "1994-roswell-report",
  "1997-roswell-case-closed",
  "2020-navy-uap-videos",
  "2021-odni-preliminary-assessment",
  "2022-congressional-uap-hearing",
  "2023-odni-annual-report",
  "2023-nasa-uap-study",
  "2024-aaro-historical-record-vol1",
  "2025-aaro-public-records",
]

let manifestPromise: Promise<PdfManifest> | null = null
let manifestData: PdfManifest | null = null

export async function loadManifest(): Promise<PdfManifest> {
  if (manifestData) {
    return manifestData
  }
  if (!manifestPromise) {
    manifestPromise = Promise.all(
      KNOWN_RELEASES.map((release) =>
        fetch(
          `${getFileUrl(`assets/${release}/pdf-pages/manifest.json`)}?v=${Date.now()}`
        )
          .then((r) => (r.ok ? (r.json() as Promise<PdfManifest>) : {}))
          .catch(() => ({}) as PdfManifest)
      )
    )
      .then((manifests) => {
        manifestData = Object.assign({}, ...manifests) as PdfManifest
        return manifestData
      })
      .catch(() => {
        manifestData = {}
        return {} as PdfManifest
      })
  }
  return manifestPromise
}

export function getPageCount(r2Key: string): number | null {
  return manifestData?.[r2Key]?.pages ?? null
}

export function getPageImageUrl(r2Key: string, page: number): string | null {
  const entry = manifestData?.[r2Key]
  if (!entry) {
    return null
  }
  const padded = String(page).padStart(3, "0")
  return getFileUrl(`${entry.basePath}/page-${padded}.jpg`)
}

const thumbCache = new Map<string, string>()

export function getCachedThumb(r2Key: string): string | null {
  return thumbCache.get(r2Key) ?? null
}

export function setCachedThumb(r2Key: string, url: string): void {
  thumbCache.set(r2Key, url)
}

const prefetched = new Set<string>()

export function prefetchIfNew(key: string): boolean {
  if (prefetched.has(key)) {
    return false
  }
  prefetched.add(key)
  return true
}
