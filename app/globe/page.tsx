import { permanentRedirect } from "next/navigation"

// we launched with a /globe route, but we've since renamed it to /map
export default function GlobeRedirectPage() {
  permanentRedirect("/map")
}
