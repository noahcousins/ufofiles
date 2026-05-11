"use client"

import { getFileUrl } from "@/lib/file-url"

interface PdfManifestEntry {
  basePath: string
  pages: number
}

type PdfManifest = Record<string, PdfManifestEntry>

let manifestPromise: Promise<PdfManifest> | null = null
let manifestData: PdfManifest | null = null

export async function loadManifest(): Promise<PdfManifest> {
  if (manifestData) {
    return manifestData
  }
  if (!manifestPromise) {
    const url = `${getFileUrl("assets/release-1/pdf-pages/manifest.json")}?v=${Date.now()}`
    manifestPromise = fetch(url)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Manifest fetch failed: ${r.status}`)
        }
        return r.json() as Promise<PdfManifest>
      })
      .then((data) => {
        manifestData = data
        return data
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
