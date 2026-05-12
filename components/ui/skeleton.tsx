import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-none bg-muted/50", className)}
      data-slot="skeleton"
      {...props}
    />
  )
}

export { Skeleton }
