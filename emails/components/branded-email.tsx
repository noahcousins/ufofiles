import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { CSSProperties, ReactNode } from "react"

// Email clients require absolute image URLs. In production the logos are served
// by the Worker (R2) from the assets bucket's `static/` folder; the standalone
// react-email preview server (no NEXT_PUBLIC_WORKER_URL) falls back to its own
// `/static/…` dir.
const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
// @todo: remove the conditional once we implement t3 env for env management
const staticBase = workerUrl ? `${workerUrl}/assets/static` : "/static"
const logoUrl = `${staticBase}/ufofiles_logo_white.png`
// Black variant for use on the light accent button.
export const logoBlackUrl = `${staticBase}/ufofiles_logo_black.png`

/**
 * Shared layout for every transactional email the app sends, so they all read
 * as the same product. Mirrors the app's brand: monochrome neutral grays on a
 * near-black page (the app defaults to its dark theme) and hard corners
 * everywhere — no border radius, matching the UI. Individual emails (magic
 * link, verification code) drop their body into `children` and reuse the
 * exported style tokens below.
 *
 * Colours are the app's dark-theme tokens (oklch neutrals from globals.css)
 * converted to hex, since email clients don't support oklch or CSS variables.
 */
export function BrandedEmail({
  preview,
  children,
}: {
  preview: string
  children: ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={wordmarkWrap}>
            <Img
              alt="[ufo]files"
              height={30}
              src={logoUrl}
              style={logo}
              width={148}
            />
          </Section>

          <Section style={card}>{children}</Section>

          <Section style={footerWrap}>
            <Text style={footerText}>
              The declassified UFO / UAP document archive.
            </Text>
            <Hr style={footerRule} />
            <Text style={footerText}>
              If you didn&apos;t request this, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// App dark-theme neutrals (globals.css oklch → hex).
const PAGE = "#0a0a0a" // --background
const CARD = "#141414" // --card
const BORDER = "#2a2a2a" // --border (white/10 over card)
const FG = "#fafafa" // --foreground
const MUTED = "#a1a1a1" // --muted-foreground
const FAINT = "#6b6b6b"
const ACCENT = "#e5e5e5" // --primary
const ACCENT_FG = "#0a0a0a" // --primary-foreground

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

const main: CSSProperties = {
  backgroundColor: PAGE,
  color: FG,
  fontFamily: FONT_STACK,
  margin: 0,
  padding: 0,
}

const container: CSSProperties = {
  margin: "0 auto",
  maxWidth: "440px",
  padding: "40px 16px 48px",
}

const wordmarkWrap: CSSProperties = {
  paddingBottom: "20px",
  textAlign: "center",
}

const logo: CSSProperties = {
  display: "inline-block",
  height: "30px",
  width: "148px",
}

const card: CSSProperties = {
  backgroundColor: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
  padding: "32px",
}

const footerWrap: CSSProperties = {
  padding: "24px 8px 0",
  textAlign: "center",
}

const footerRule: CSSProperties = {
  borderColor: BORDER,
  margin: "16px auto",
  width: "40px",
}

const footerText: CSSProperties = {
  color: FAINT,
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
}

/** Tokens shared by the individual email templates. */
export const heading: CSSProperties = {
  color: FG,
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: "0 0 12px",
}

export const paragraph: CSSProperties = {
  color: MUTED,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 24px",
}

export const ctaWrap: CSSProperties = {
  padding: "4px 0 8px",
  textAlign: "center",
}

export const button: CSSProperties = {
  backgroundColor: ACCENT,
  borderRadius: 0,
  color: ACCENT_FG,
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
}

export const codeChip: CSSProperties = {
  backgroundColor: PAGE,
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
  color: FG,
  display: "inline-block",
  fontFamily: MONO_STACK,
  fontSize: "30px",
  fontWeight: 700,
  letterSpacing: "0.35em",
  margin: 0,
  padding: "16px 22px 16px 32px",
}

export const fallbackLink: CSSProperties = {
  color: FAINT,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "20px 0 0",
  wordBreak: "break-all",
}
