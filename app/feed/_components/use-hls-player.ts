import Hls from "hls.js"
import { useEffect, useState } from "react"

export function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  hlsUrl: string | null
): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (!hlsUrl) {
      video.removeAttribute("src")
      video.load()
      setIsReady(false)
      return
    }

    setIsReady(false)

    const onCanPlay = () => setIsReady(true)
    video.addEventListener("canplay", onCanPlay, { once: true })

    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls({
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
    }
  }, [hlsUrl, videoRef])

  return { isReady }
}
