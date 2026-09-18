/**
 * Where auth flows land when there's no explicit (and safe) `?redirect`/dest —
 * the post-sign-in default and the open-redirect fallback. The home page.
 */
export const DEFAULT_AUTH_REDIRECT = "/"

/** Which tab the auth dialog opens on. */
export type AuthMode = "signin" | "signup"

/** The auth dialog's current view in its step machine. */
export type AuthStep = "form" | "forgot" | "magicSent" | "resetSent"

/**
 * Why the dialog was opened. Drives the headline copy so a gate can pitch its
 * own benefit ("unlimited access") instead of the generic sign-up line.
 */
export type AuthIntent = "default" | "unlimited"
