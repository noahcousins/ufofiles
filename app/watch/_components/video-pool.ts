// Persistent pool of <video> elements recycled across feed panels.
//
// iOS WebKit gates playback per ELEMENT: an element that has had play()/load()
// called inside a real user gesture is "blessed" permanently — programmatic
// play() is then allowed even off-gesture, even in Low Power Mode, and the
// blessing survives src changes. Creating a fresh <video> per panel meant
// panels mounted after the last gesture could never autoplay (swipe touchends
// don't reliably carry user activation on iOS Chrome). Recycling a fixed pool
// lets one tap bless every element the feed will ever use.
//
// Size must cover the preload window: active + MAX_AHEAD + MAX_BEHIND. The
// window is always a contiguous run of ≤4 indices, so index % 4 never
// collides between simultaneously mounted panels.
export const VIDEO_POOL_SIZE = 4

export function createPooledVideo(): HTMLVideoElement {
  const v = document.createElement("video")
  v.playsInline = true
  v.muted = true
  v.preload = "auto"
  v.className = "h-full w-full object-contain"
  return v
}
