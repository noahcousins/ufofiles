import type { MDXComponents } from "mdx/types"
import type { ComponentPropsWithoutRef } from "react"

/** Styling for legal MDX (privacy, terms) — plain prose, no custom blocks. */
export const legalMdxComponents: MDXComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-6 mb-1.5 font-medium text-base text-foreground"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-4 mb-1.5 font-medium text-foreground text-sm"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p
      className="mb-3 text-muted-foreground text-sm leading-relaxed"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="mb-3 ml-5 list-disc space-y-1 text-muted-foreground text-sm"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="mb-3 ml-5 list-decimal space-y-1 text-muted-foreground text-sm"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="text-sm leading-relaxed" {...props} />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-medium text-foreground" {...props} />
  ),
}
