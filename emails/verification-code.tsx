import { Heading, Section, Text } from "@react-email/components"
import {
  BrandedEmail,
  codeChip,
  ctaWrap,
  heading,
  paragraph,
} from "./components/branded-email"

/** Sent on email/password sign-up to verify the address with a one-time code. */
export function VerificationCodeEmail({ code }: { code: string }) {
  return (
    <BrandedEmail preview="Your [ufo]files verification code">
      <Heading style={heading}>Verify your email</Heading>
      <Text style={paragraph}>
        Enter this code to confirm your account. It expires shortly and can be
        used once.
      </Text>
      <Section style={ctaWrap}>
        <Text style={codeChip}>{code}</Text>
      </Section>
    </BrandedEmail>
  )
}

VerificationCodeEmail.PreviewProps = {
  code: "428913",
}

export default VerificationCodeEmail
