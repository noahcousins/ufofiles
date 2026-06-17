import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { auth } from "@/lib/auth"
import type { TRPCContext } from "@/lib/trpc/init"
import { appRouter } from "@/lib/trpc/router"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async (): Promise<TRPCContext> => {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        undefined

      const session = await auth.api.getSession({ headers: req.headers })
      const user = session
        ? {
            id: session.user.id,
            email: session.user.email,
            emailVerified: session.user.emailVerified,
          }
        : null

      return { clientIp, headers: req.headers, user }
    },
  })

export { handler as GET, handler as POST }
