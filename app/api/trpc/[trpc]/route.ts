import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import type { TRPCContext } from "@/lib/trpc/init"
import { appRouter } from "@/lib/trpc/router"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (): TRPCContext => {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        undefined
      return { clientIp }
    },
  })

export { handler as GET, handler as POST }
