import type { MDXComponents } from "mdx/types"
import type { ComponentPropsWithoutRef } from "react"
import { Separator } from "@/components/ui/separator"
import { Callout } from "./callout"
import { ChangeItem } from "./change-item"

export const changelogMdxComponents: MDXComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-6 mb-3 font-heading font-semibold text-base text-foreground tracking-tight"
      {...props}
    />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="mt-4 mb-2 font-heading font-medium text-foreground text-sm tracking-tight"
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
      className="mb-3 ml-4 list-disc space-y-1.5 text-muted-foreground text-sm"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="mb-3 ml-4 list-decimal space-y-1.5 text-muted-foreground text-sm"
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
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="mb-4 overflow-x-auto border border-border/50 bg-muted p-4 font-mono text-xs"
      {...props}
    />
  ),
  hr: () => <Separator className="my-6" />,
  img: (props: ComponentPropsWithoutRef<"img">) => (
    // biome-ignore lint/a11y/useAltText: alt is passed via props from MDX
    // biome-ignore lint/correctness/useImageSize: dimensions come from MDX content
    // biome-ignore lint/performance/noImgElement: MDX images can't use next/image
    <img className="my-4 max-w-full border border-border/50" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-border/50 border-l-2 border-l-muted-foreground/30 pl-4 text-muted-foreground text-sm italic"
      {...props}
    />
  ),

  // Custom components
  ChangeItem,
  Callout,
}
