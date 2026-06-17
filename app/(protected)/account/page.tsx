import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { AccountSecurity } from "./account-security"
import { EmailPreferences } from "./email-preferences"

export const metadata: Metadata = {
  title: "Account - [ufo]files",
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <>
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-5 font-mono font-normal text-muted-foreground text-sm uppercase tracking-wide">
          Account
        </h1>
        <div className="space-y-5">
          <AccountSecurity />
          <EmailPreferences />
        </div>
      </div>
    </>
  )
}
