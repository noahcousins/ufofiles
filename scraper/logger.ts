type Status = "OK" | "SKIP" | "FAIL" | "ERROR"

/** Log a progress line: `[1/100] OK: filename (42 KB)` */
export function progress(
  index: number,
  total: number,
  status: Status,
  name: string,
  detail?: string
): void {
  const tag = `[${index + 1}/${total}]`
  const suffix = detail ? ` (${detail})` : ""
  console.log(`${tag} ${status}: ${name}${suffix}`)
}

/** Print a summary block wrapped in `========` dividers */
export function summary(lines: string[]): void {
  console.log("\n========================================")
  for (const line of lines) {
    console.log(line)
  }
  console.log("========================================")
}

export function info(msg: string): void {
  console.log(msg)
}

export function warn(msg: string): void {
  console.warn(`WARN: ${msg}`)
}

export function error(msg: string): void {
  console.error(`ERROR: ${msg}`)
}
