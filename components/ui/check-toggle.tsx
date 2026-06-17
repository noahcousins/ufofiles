import { CheckIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

/**
 * Square on-brand switch — a bordered box that fills with a check when on.
 * Shared by the consent banner and account email preferences.
 */
export function CheckToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onChange?: (next: boolean) => void
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center border border-border transition-colors",
        checked ? "bg-foreground text-background" : "bg-transparent",
        disabled ? "opacity-50" : "hover:border-ring"
      )}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      role="switch"
      type="button"
    >
      {checked && <CheckIcon className="size-3.5" weight="bold" />}
    </button>
  )
}
