import { Button, Heading, Img, Section, Text } from "@react-email/components"
import {
  BrandedEmail,
  button,
  ctaWrap,
  fallbackLink,
  heading,
  logoBlackUrl,
  paragraph,
} from "./components/branded-email"

/** Sent when a user requests a passwordless sign-in link. */
export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <BrandedEmail preview="Your [ufo]files sign-in link">
      <Heading style={heading}>Sign in to [ufo]files</Heading>
      <Text style={paragraph}>
        Click the button below to sign in. This link expires shortly and can be
        used once.
      </Text>
      <Section style={ctaWrap}>
        <Button href={url} style={button}>
          Sign in to{" "}
          <Img
            alt="[ufo]files"
            height={13}
            src={logoBlackUrl}
            style={buttonLogo}
            width={64}
          />
        </Button>
      </Section>
      <Text style={fallbackLink}>
        Or paste this link into your browser: {url}
      </Text>
    </BrandedEmail>
  )
}

const buttonLogo = {
  display: "inline-block",
  height: "13px",
  marginBottom: "1px",
  verticalAlign: "middle",
  width: "64px",
}

MagicLinkEmail.PreviewProps = {
  url: "https://showmeufos.com/api/auth/magic-link/verify?token=preview",
}

export default MagicLinkEmail
