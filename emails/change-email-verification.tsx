import { Button, Heading, Section, Text } from "@react-email/components"
import {
  BrandedEmail,
  button,
  ctaWrap,
  fallbackLink,
  heading,
  paragraph,
} from "./components/branded-email"

/**
 * Sent to a user's *current* email when they request to change it. Clicking the
 * link confirms the change to `newEmail`; ignoring it leaves the account as-is.
 */
export function ChangeEmailVerificationEmail({
  newEmail,
  url,
}: {
  newEmail: string
  url: string
}) {
  return (
    <BrandedEmail preview="Confirm your new [ufo]files email address">
      <Heading style={heading}>Confirm your new email</Heading>
      <Text style={paragraph}>
        We received a request to change the email on your [ufo]files account to{" "}
        <strong>{newEmail}</strong>. Click the button below to confirm. This
        link expires shortly and can be used once. If you didn't request this,
        you can safely ignore this email — your address won't change.
      </Text>
      <Section style={ctaWrap}>
        <Button href={url} style={button}>
          Confirm new email
        </Button>
      </Section>
      <Text style={fallbackLink}>
        Or paste this link into your browser: {url}
      </Text>
    </BrandedEmail>
  )
}

ChangeEmailVerificationEmail.PreviewProps = {
  newEmail: "new@example.com",
  url: "https://showmeufos.com/api/auth/verify-email?token=preview",
}

export default ChangeEmailVerificationEmail
