import Hls from "hls.js"
import { useEffect, useState } from "react"

export function useHlsPlayer(
  video: HTMLVideoElement | null,
  hlsUrl: string | null
): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!video) {
      setIsReady(false)
      return
    }

    if (!hlsUrl) {
      video.removeAttribute("src")
      video.load()
      setIsReady(false)
      return
    }

    setIsReady(false)

    const onCanPlay = () => {
      setIsReady(true)
    }
    video.addEventListener("canplay", onCanPlay, { once: true })

    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({
        backBufferLength: 10,
        maxBufferLength: 10,
        maxMaxBufferLength: 30,
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn("[hls] fatal error:", data.type, data.details)
        }
      })

      hls.loadSource(hlsUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl
      video.load()
    }

    return () => {
      video.removeEventListener("canplay", onCanPlay)
      if (hls) {
        hls.destroy()
      }
      // Force WebKit to release the media pipeline NOW and blank the element
      // for its next pooled use. Unmounting/destroying alone leaves the
      // platform media player alive until GC; on iOS the device caps
      // concurrent pipelines and leaked ones stop later videos from playing.
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [hlsUrl, video])

  return { isReady }
}
