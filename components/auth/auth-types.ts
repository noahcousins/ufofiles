/** Which tab the auth dialog opens on. */
export type AuthMode = "signin" | "signup"

/** The auth dialog's current view in its step machine. */
export type AuthStep = "form" | "forgot" | "magicSent" | "resetSent"
