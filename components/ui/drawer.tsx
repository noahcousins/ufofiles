"use client"

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn("fixed inset-0 z-50 bg-transparent", className)}
      data-slot="drawer-overlay"
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex items-end overflow-hidden">
        <DrawerPrimitive.Popup
          className={cn(
            "flex w-full flex-col bg-popover text-popover-foreground text-xs/relaxed outline-none",
            "rounded-none border-t",
            "[transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]",
            "[transition:transform_300ms_cubic-bezier(0.32,0.72,0,1)]",
            "data-[starting-style]:[transform:translateY(100%)]",
            "data-[ending-style]:[transform:translateY(100%)]",
            className
          )}
          data-slot="drawer-content"
          {...props}
        >
          <div className="flex shrink-0 cursor-grab items-center justify-center py-4 active:cursor-grabbing">
            <div className="h-1 w-[100px] rounded-none bg-muted" />
          </div>
          <DrawerPrimitive.Content className="relative flex flex-col overflow-y-auto">
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 p-4 md:gap-0.5 md:text-left",
        className
      )}
      data-slot="drawer-header"
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="drawer-footer"
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn(
        "font-heading font-medium text-foreground text-sm",
        className
      )}
      data-slot="drawer-title"
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-xs/relaxed", className)}
      data-slot="drawer-description"
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
