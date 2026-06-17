/** Small shared bits for the auth dialog. */

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-wide">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function ModeSwitch({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="font-medium text-foreground underline-offset-2 hover:underline"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}
