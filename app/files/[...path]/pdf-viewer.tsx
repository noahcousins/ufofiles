"use client"

import { useEffect, useRef, useState } from "react"
import { getFileUrl } from "@/lib/file-url"

const PDF_REGEX = /\.pdf$/i

function getPageUrl(r2Key: string, page: number): string {
  const parts = r2Key.split("/")
  const filename = parts.pop()!
  const stem = filename.replace(PDF_REGEX, "")
  const prefix = parts.join("/")
  const padded = String(page).padStart(3, "0")
  return getFileUrl(`${prefix}/pdf-pages/${stem}/page-${padded}.jpg`)
}

export function PdfViewer({
  r2Key,
  pageCount,
}: {
  r2Key: string
  pageCount: number
}) {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute("data-page"))
            if (pageNum) {
              setCurrentPage(pageNum)
            }
          }
        }
      },
      {
        root: null,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      }
    )

    for (const ref of pageRefs.current) {
      if (ref) {
        observer.observe(ref)
      }
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "PageDown" || (e.key === "ArrowDown" && e.altKey)) {
        e.preventDefault()
        const next = Math.min(currentPage + 1, pageCount)
        pageRefs.current[next - 1]?.scrollIntoView({ behavior: "smooth" })
      } else if (e.key === "PageUp" || (e.key === "ArrowUp" && e.altKey)) {
        e.preventDefault()
        const prev = Math.max(currentPage - 1, 1)
        pageRefs.current[prev - 1]?.scrollIntoView({ behavior: "smooth" })
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [currentPage, pageCount])

  return (
    <div className="bg-muted/30">
      <div className="mx-auto flex max-w-4xl flex-col gap-1 px-2 py-4">
        {Array.from({ length: pageCount }, (_, i) => {
          const page = i + 1
          return (
            <div
              data-page={page}
              key={page}
              ref={(el) => {
                pageRefs.current[i] = el
              }}
            >
              <img
                alt={`Page ${page}`}
                className="w-full shadow-sm"
                decoding={page <= 3 ? "sync" : "async"}
                loading={page <= 3 ? "eager" : "lazy"}
                src={getPageUrl(r2Key, page)}
              />
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0))] left-1/2 z-10 -translate-x-1/2">
        <div className="rounded-full bg-black/70 px-3 py-1 text-white text-xs tabular-nums backdrop-blur-sm">
          {currentPage} / {pageCount}
        </div>
      </div>
    </div>
  )
}
