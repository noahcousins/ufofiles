export type ScrollDirection = "down" | "up"
export type LoadState = "active" | "preload" | "idle"

const MAX_AHEAD = 6
const MAX_BEHIND = 1

export function computeLoadState(
  index: number,
  activeIndex: number,
  scrollDirection: ScrollDirection
): LoadState {
  if (index === activeIndex) {
    return "active"
  }

  const distance = index - activeIndex
  const absDist = Math.abs(distance)
  const isAhead = scrollDirection === "down" ? distance > 0 : distance < 0

  if (isAhead && absDist <= MAX_AHEAD) {
    return "preload"
  }
  if (!isAhead && absDist <= MAX_BEHIND) {
    return "preload"
  }

  return "idle"
}
