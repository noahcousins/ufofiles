import type { Metadata } from "next"
import { SignedInLanding } from "@/components/auth/signed-in-landing"

export const metadata: Metadata = {
  title: "Signed in - [ufo]files",
  robots: { index: false, follow: false },
}

// Where the magic link lands the clicking tab. The original tab handles the
// real redirect itself, so this page is static — no callback params to validate.
export default function SignedInPage() {
  return <SignedInLanding />
}
