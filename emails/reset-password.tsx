import { Button, Heading, Section, Text } from "@react-email/components"
import {
  BrandedEmail,
  button,
  ctaWrap,
  fallbackLink,
  heading,
  paragraph,
} from "./components/branded-email"

/** Sent when a user requests a password reset. */
export function ResetPasswordEmail({ url }: { url: string }) {
  return (
    <BrandedEmail preview="Reset your [ufo]files password">
      <Heading style={heading}>Reset your password</Heading>
      <Text style={paragraph}>
        Click the button below to choose a new password. This link expires
        shortly and can be used once. If you didn't request this, you can safely
        ignore this email — your password won't change.
      </Text>
      <Section style={ctaWrap}>
        <Button href={url} style={button}>
          Reset password
        </Button>
      </Section>
      <Text style={fallbackLink}>
        Or paste this link into your browser: {url}
      </Text>
    </BrandedEmail>
  )
}

ResetPasswordEmail.PreviewProps = {
  url: "https://showmeufos.com/api/auth/reset-password/preview?callbackURL=/reset-password",
}

export default ResetPasswordEmail
