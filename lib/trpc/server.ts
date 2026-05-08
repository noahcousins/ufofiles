import "server-only"
import { createHydrationHelpers } from "@trpc/react-query/rsc"
import { cache } from "react"
import { createCallerFactory } from "./init"
import { makeQueryClient } from "./query-client"
import { appRouter } from "./router"

export const getQueryClient = cache(makeQueryClient)

const createCaller = createCallerFactory(appRouter)
const caller = createCaller({})

export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient
)
