"use client"

import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Transition,
  type Variant,
} from "motion/react"
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import useClickOutside from "@/hooks/use-click-outside"
import { cn } from "@/lib/utils"

export interface MorphingDialogContextType {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  triggerRef: React.RefObject<HTMLButtonElement | null>
  uniqueId: string
}

const MorphingDialogContext =
  React.createContext<MorphingDialogContextType | null>(null)

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext)
  if (!context) {
    throw new Error(
      "useMorphingDialog must be used within a MorphingDialogProvider"
    )
  }
  return context
}

export interface MorphingDialogProviderProps {
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  transition?: Transition
}

function MorphingDialogProvider({
  children,
  transition,
  open: controlledOpen,
  onOpenChange,
}: MorphingDialogProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const uniqueId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null!)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (value) => {
      const next = typeof value === "function" ? value(isOpen) : value
      if (!isControlled) {
        setUncontrolledOpen(next)
      }
      onOpenChange?.(next)
    },
    [isOpen, isControlled, onOpenChange]
  )

  const contextValue = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      uniqueId,
      triggerRef,
    }),
    [isOpen, setIsOpen, uniqueId]
  )

  return (
    <MorphingDialogContext.Provider value={contextValue}>
      <MotionConfig transition={transition}>{children}</MotionConfig>
    </MorphingDialogContext.Provider>
  )
}

export interface MorphingDialogProps {
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  transition?: Transition
}

function MorphingDialog({
  children,
  transition,
  open,
  onOpenChange,
}: MorphingDialogProps) {
  return (
    <MorphingDialogProvider onOpenChange={onOpenChange} open={open}>
      <MotionConfig transition={transition}>{children}</MotionConfig>
    </MorphingDialogProvider>
  )
}

export interface MorphingDialogTriggerProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  triggerRef?: React.RefObject<HTMLButtonElement>
}

function MorphingDialogTrigger({
  children,
  className,
  style,
  triggerRef,
}: MorphingDialogTriggerProps) {
  const { setIsOpen, isOpen, uniqueId } = useMorphingDialog()

  const handleClick = useCallback(() => {
    setIsOpen(!isOpen)
  }, [isOpen, setIsOpen])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setIsOpen(!isOpen)
      }
    },
    [isOpen, setIsOpen]
  )

  return (
    <motion.button
      aria-controls={`motion-ui-morphing-dialog-content-${uniqueId}`}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={`Open dialog ${uniqueId}`}
      className={cn("relative cursor-pointer", className)}
      layoutId={`dialog-${uniqueId}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={triggerRef}
      style={style}
    >
      {children}
    </motion.button>
  )
}

export interface MorphingDialogContentProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function MorphingDialogContent({
  children,
  className,
  style,
}: MorphingDialogContentProps) {
  const { setIsOpen, isOpen, uniqueId, triggerRef } = useMorphingDialog()
  const containerRef = useRef<HTMLDivElement>(null!)
  const [firstFocusableElement, setFirstFocusableElement] =
    useState<HTMLElement | null>(null)
  const [lastFocusableElement, setLastFocusableElement] =
    useState<HTMLElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
      if (event.key === "Tab") {
        if (!(firstFocusableElement && lastFocusableElement)) {
          return
        }

        if (event.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            event.preventDefault()
            lastFocusableElement.focus()
          }
        } else if (document.activeElement === lastFocusableElement) {
          event.preventDefault()
          firstFocusableElement.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [setIsOpen, firstFocusableElement, lastFocusableElement])

  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add("overflow-hidden")
      document.body.classList.add("overflow-hidden")
      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements && focusableElements.length > 0) {
        setFirstFocusableElement(focusableElements[0] as HTMLElement)
        setLastFocusableElement(
          focusableElements.item(focusableElements.length - 1) as HTMLElement
        )
        ;(focusableElements[0] as HTMLElement).focus()
      }
    } else {
      document.documentElement.classList.remove("overflow-hidden")
      document.body.classList.remove("overflow-hidden")
      triggerRef.current?.focus()
    }

    return () => {
      document.documentElement.classList.remove("overflow-hidden")
      document.body.classList.remove("overflow-hidden")
    }
  }, [isOpen, triggerRef])

  useClickOutside(containerRef, () => {
    if (isOpen) {
      setIsOpen(false)
    }
  })

  return (
    <motion.div
      aria-describedby={`motion-ui-morphing-dialog-description-${uniqueId}`}
      aria-labelledby={`motion-ui-morphing-dialog-title-${uniqueId}`}
      aria-modal="true"
      className={cn("overflow-hidden", className)}
      layoutId={`dialog-${uniqueId}`}
      ref={containerRef}
      role="dialog"
      style={style}
    >
      {children}
    </motion.div>
  )
}

export interface MorphingDialogContainerProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function MorphingDialogContainer({ children }: MorphingDialogContainerProps) {
  const { isOpen, uniqueId } = useMorphingDialog()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) {
    return null
  }

  return createPortal(
    <div style={{ pointerEvents: isOpen ? "auto" : "none" }}>
      <AnimatePresence initial={false} mode="sync">
        {isOpen && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 h-full w-full bg-white/40 backdrop-blur-xs dark:bg-black/40"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={`backdrop-${uniqueId}`}
              onTouchMove={(e) => e.preventDefault()}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain">
              {children}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}

export interface MorphingDialogTitleProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function MorphingDialogTitle({
  children,
  className,
  style,
}: MorphingDialogTitleProps) {
  const { uniqueId } = useMorphingDialog()

  return (
    <motion.div
      className={className}
      layout
      layoutId={`dialog-title-container-${uniqueId}`}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export interface MorphingDialogSubtitleProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

function MorphingDialogSubtitle({
  children,
  className,
  style,
}: MorphingDialogSubtitleProps) {
  const { uniqueId } = useMorphingDialog()

  return (
    <motion.div
      className={className}
      layoutId={`dialog-subtitle-container-${uniqueId}`}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export interface MorphingDialogDescriptionProps {
  children: React.ReactNode
  className?: string
  disableLayoutAnimation?: boolean
  variants?: {
    initial: Variant
    animate: Variant
    exit: Variant
  }
}

function MorphingDialogDescription({
  children,
  className,
  variants,
  disableLayoutAnimation,
}: MorphingDialogDescriptionProps) {
  const { uniqueId } = useMorphingDialog()

  return (
    <motion.div
      animate="animate"
      className={className}
      exit="exit"
      id={`dialog-description-${uniqueId}`}
      initial="initial"
      key={`dialog-description-${uniqueId}`}
      layoutId={
        disableLayoutAnimation
          ? undefined
          : `dialog-description-content-${uniqueId}`
      }
      variants={variants}
    >
      {children}
    </motion.div>
  )
}

export interface MorphingDialogImageProps {
  alt: string
  className?: string
  onError?: React.ReactEventHandler<HTMLImageElement>
  src: string
  style?: React.CSSProperties
}

function MorphingDialogImage({
  src,
  alt,
  className,
  style,
  onError,
}: MorphingDialogImageProps) {
  const { uniqueId } = useMorphingDialog()

  return (
    <motion.img
      alt={alt}
      className={cn(className)}
      layoutId={`dialog-img-${uniqueId}`}
      onError={onError}
      src={src}
      style={style}
    />
  )
}

export interface MorphingDialogCloseProps {
  children?: React.ReactNode
  className?: string
  variants?: {
    initial: Variant
    animate: Variant
    exit: Variant
  }
}

function MorphingDialogClose({
  children,
  className,
  variants,
}: MorphingDialogCloseProps) {
  const { setIsOpen, uniqueId } = useMorphingDialog()

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  return (
    <motion.button
      animate="animate"
      aria-label="Close dialog"
      className={cn("absolute top-12 right-6", className)}
      exit="exit"
      initial="initial"
      key={`dialog-close-${uniqueId}`}
      onClick={handleClose}
      type="button"
      variants={variants}
    >
      {children || (
        <svg
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      )}
    </motion.button>
  )
}

export {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogDescription,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
  useMorphingDialog,
}
