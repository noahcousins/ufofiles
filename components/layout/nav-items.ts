import {
  BookmarkSimpleIcon,
  ClockCounterClockwise,
  DownloadSimple,
  GithubLogoIcon,
  GlobeHemisphereWest,
  MagnifyingGlassIcon,
  MonitorPlayIcon,
  XLogoIcon,
} from "@phosphor-icons/react/dist/ssr"

// Shared between the header's mobile sheet and the feed's desktop sidebar so
// the two navigations never drift.
export const navLinks = [
  { href: "/", label: "Search", icon: MagnifyingGlassIcon },
  { href: "/watch", label: "Watch", icon: MonitorPlayIcon },
  { href: "/globe", label: "Incident Map", icon: GlobeHemisphereWest },
  { href: "/releases", label: "Releases", icon: DownloadSimple },
  { href: "/library", label: "Library", icon: BookmarkSimpleIcon },
  { href: "/changelog", label: "Changelog", icon: ClockCounterClockwise },
]

export const socialLinks = [
  { href: "https://x.com/noahwebdev", label: "X (Twitter)", icon: XLogoIcon },
  {
    href: "https://github.com/noahcousins/ufofiles",
    label: "GitHub",
    icon: GithubLogoIcon,
  },
]
