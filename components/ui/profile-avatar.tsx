import BoringAvatar from "boring-avatars"
import { cn } from "@/lib/utils"

/**
 * Monochrome neutral palette (light → dark) so the generated "marble" gradient
 * reads as a brand-tinted grayscale blob rather than the library's default
 * rainbow. Shades track Tailwind's neutral scale (200/400/500/700/900).
 */
const MONOCHROME_COLORS = [
  "#e5e5e5",
  "#a3a3a3",
  "#737373",
  "#404040",
  "#171717",
]

/**
 * The signed-in user's avatar: a deterministic gradient blob seeded by their
 * email, rendered monochrome to match the app's mono UI. Uses boring-avatars'
 * "marble" variant for the soft gradient look.
 */
export function ProfileAvatar({
  seed,
  size = 22,
  className,
}: {
  seed?: string | null
  size?: number
  className?: string
}) {
  return (
    <span className={cn("inline-flex overflow-hidden rounded-full", className)}>
      <BoringAvatar
        colors={MONOCHROME_COLORS}
        name={seed ?? "account"}
        size={size}
        variant="marble"
      />
    </span>
  )
}
