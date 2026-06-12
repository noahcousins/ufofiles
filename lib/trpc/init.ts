import { initTRPC } from "@trpc/server"
import superjson from "superjson"

/** The current identity on a request, resolved from the better-auth session. */
export interface SessionUser {
  email: string
  /** Magic-link and Google sign-ins arrive verified; gates Export (ADR-0003). */
  emailVerified: boolean
  id: string
  /** True for a Guest (anonymous, credential-less). */
  isAnonymous: boolean
}

export interface TRPCContext {
  clientIp?: string
  user?: SessionUser | null
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory
