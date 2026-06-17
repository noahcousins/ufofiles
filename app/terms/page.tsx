import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service - [ufo]files",
  description: "The terms for using [ufo]files.",
}

export default function TermsPage() {
  return <LegalPage slug="terms" />
}
