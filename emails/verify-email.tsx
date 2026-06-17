import { Button, Heading, Section, Text } from "@react-email/components"
import {
  BrandedEmail,
  button,
  ctaWrap,
  fallbackLink,
  heading,
  paragraph,
} from "./components/branded-email"

/** Sent to confirm ownership of an email address (e.g. after an email change). */
export function VerifyEmail({ url }: { url: string }) {
  return (
    <BrandedEmail preview="Verify your [ufo]files email">
      <Heading style={heading}>Verify your email</Heading>
      <Text style={paragraph}>
        Click the button below to confirm this address. This link expires
        shortly and can be used once. If you didn't request this, you can safely
        ignore this email.
      </Text>
      <Section style={ctaWrap}>
        <Button href={url} style={button}>
          Verify email
        </Button>
      </Section>
      <Text style={fallbackLink}>
        Or paste this link into your browser: {url}
      </Text>
    </BrandedEmail>
  )
}

VerifyEmail.PreviewProps = {
  url: "https://showmeufos.com/api/auth/verify-email?token=preview",
}

export default VerifyEmail
