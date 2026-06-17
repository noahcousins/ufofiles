"use client"

import { AnimatePresence, motion } from "motion/react"
import { useSyncExternalStore } from "react"

// Deliberately tiny: a module store + <Toaster/>. Enough to confirm "Clip
// added" from both the in-feed commit and the post-auth replay. Not a general
// notification system.

interface ToastItem {
  id: number
  message: string
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) {
    l()
  }
}

export function toast(message: string): void {
  const id = nextId++
  items = [...items, { id, message }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 2500)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return items
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, () => items)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="rounded-none bg-foreground px-4 py-2 font-mono text-background text-xs shadow-lg"
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            key={t.id}
            transition={{ duration: 0.18 }}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
