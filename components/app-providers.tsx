"use client"

import { NuqsAdapter } from "nuqs/adapters/next/app"
import type { ComponentProps } from "react"
import { AuthDialogProvider } from "@/components/auth/auth-dialog-provider"
import { EmailVerificationProvider } from "@/components/auth/email-verification-provider"
import { ClipProgress } from "@/components/clips/clip-progress"
import { PendingClipReplay } from "@/components/clips/pending-clip-replay"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { SessionProvider } from "@/lib/auth/session-provider"
import { TRPCProvider } from "@/lib/trpc/provider"

/**
 * The single composition of every app-wide provider, in one readable place.
 * Order matters: session (server-seeded) → consent → URL state → tRPC →
 * the auth gates (sign-in dialog + email verification) → theme. The
 * mount-only globals (clip replay/progress, toasts) live alongside, inside the
 * tRPC client so they can use it.
 */
export function AppProviders({
  initialSession,
  consentRequired,
  children,
}: {
  initialSession: ComponentProps<typeof SessionProvider>["initialSession"]
  consentRequired: boolean
  children: React.ReactNode
}) {
  return (
    <SessionProvider initialSession={initialSession}>
      <ConsentProvider consentRequired={consentRequired}>
        <NuqsAdapter>
          <TRPCProvider>
            <EmailVerificationProvider>
              <AuthDialogProvider>
                <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
              </AuthDialogProvider>
            </EmailVerificationProvider>
            <PendingClipReplay />
            <ClipProgress />
            <Toaster />
          </TRPCProvider>
        </NuqsAdapter>
      </ConsentProvider>
    </SessionProvider>
  )
}
