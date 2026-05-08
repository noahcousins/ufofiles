"use client"

import { AnimatePresence, motion } from "motion/react"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export interface FullscreenMediaViewerProps {
  alt?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  src: string
  type: "image" | "pdf"
}

export function FullscreenMediaViewer({
  open,
  onOpenChange,
  src,
  alt = "",
  type,
}: FullscreenMediaViewerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
      return
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        handleClose()
      }
    }
    document.addEventListener("keydown", handler, true)
    return () => document.removeEventListener("keydown", handler, true)
  }, [open, handleClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!mounted) {
    return null
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex flex-col"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative z-10 flex items-center justify-between px-4 py-3">
            <p className="max-w-[70%] truncate text-sm text-white/70">
              {alt || (type === "pdf" ? "PDF Document" : "Image")}
            </p>
            <div className="flex items-center gap-2">
              <a
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                download
                href={src}
                onClick={(e) => e.stopPropagation()}
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download
              </a>
              <button
                aria-label="Close fullscreen viewer"
                className="flex items-center justify-center p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                onClick={handleClose}
              >
                <svg
                  fill="none"
                  height="20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {type === "pdf" ? (
              <object
                className="h-full w-full"
                data={src}
                type="application/pdf"
              >
                <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
                  <p className="text-sm">Unable to display PDF inline.</p>
                  <a
                    className="bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                    download
                    href={src}
                  >
                    Download PDF
                  </a>
                </div>
              </object>
            ) : (
              <img
                alt={alt}
                className="max-h-full max-w-full object-contain"
                src={src}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function ExpandButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <button
      aria-label="View fullscreen"
      className={cn(
        "flex items-center gap-1.5 bg-black/50 px-2.5 py-1.5 text-white/80 text-xs backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      <svg
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Expand
    </button>
  )
}
