import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = {
  title: "Reset password - [ufo]files",
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // better-auth redirects the email link here with `?token=…`, or `?error=…`
  // when the token is expired/invalid.
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : null
  const tokenError = typeof params.error === "string"

  return <ResetPasswordForm token={token} tokenError={tokenError} />
}
