import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy - [ufo]files",
  description: "How [ufo]files collects and uses your data.",
}

export default function PrivacyPage() {
  return <LegalPage slug="privacy" />
}
