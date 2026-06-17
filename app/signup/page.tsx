import { Suspense } from "react"
import { AuthRoute } from "@/components/auth/auth-route"

export default function SignupPage() {
  return (
    <Suspense>
      <AuthRoute mode="signup" />
    </Suspense>
  )
}
