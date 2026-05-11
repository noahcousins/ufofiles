const nextConfig = {
  async rewrites() {
    return [
      // posthog
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      // app redirects
      {
        source: "/globe",
        destination: "/map",
        permanent: true,
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

export default nextConfig
