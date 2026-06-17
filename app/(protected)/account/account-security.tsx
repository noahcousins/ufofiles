"use client"

import {
  EnvelopeSimpleIcon,
  GoogleLogoIcon,
  LockKeyIcon,
} from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useAuthActions, useSession } from "@/lib/auth/session-provider"
import { trpc } from "@/lib/trpc/client"

/**
 * Sign-in methods: a single list of how the user can sign in — email, password,
 * and Google — each a row with an icon, status, and an action. Email and
 * password are only editable for accounts that have a password (signed up with
 * email + password); Google can be linked/unlinked.
 */
export function AccountSecurity() {
  const providers = trpc.account.providers.useQuery()
  const config = trpc.me.config.useQuery()
  const hasPassword = providers.data?.hasPassword ?? false
  const hasGoogle = providers.data?.hasGoogle ?? false

  return (
    <section className="border border-border bg-card">
      <div className="border-border border-b px-4 py-3">
        <h2 className="font-medium text-sm">Sign-in methods</h2>
        <p className="text-muted-foreground text-xs">
          How you sign in to your account.
        </p>
      </div>
      {providers.isLoading ? (
        <div className="flex items-center justify-center px-4 py-8">
          <Spinner />
        </div>
      ) : (
        <div className="divide-y divide-border">
          <EmailRow
            hasPassword={hasPassword}
            providers={providers.data?.providers ?? []}
          />
          <PasswordRow hasPassword={hasPassword} />
          {config.data?.googleEnabled && <GoogleRow hasGoogle={hasGoogle} />}
        </div>
      )}
    </section>
  )
}

/** Shared row chrome: icon + title/description on the left, action on the right,
 *  with an optional expanded edit area below. */
function MethodRow({
  action,
  children,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode
  children?: React.ReactNode
  description: React.ReactNode
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <div className="min-w-0">
            <p className="font-medium text-xs">{title}</p>
            <p className="truncate text-[11px] text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        {action}
      </div>
      {children && <div className="mt-3 pl-8">{children}</div>}
    </div>
  )
}

function EmailRow({
  hasPassword,
  providers,
}: {
  hasPassword: boolean
  providers: string[]
}) {
  const { data: session } = useSession()
  const { refetch } = useAuthActions()
  const utils = trpc.useUtils()
  const currentEmail = session?.user.email ?? ""

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentEmail)

  const changeEmail = trpc.account.changeEmail.useMutation({
    onSuccess: async ({ confirmationSent }) => {
      setEditing(false)
      if (confirmationSent) {
        toast(`Check ${currentEmail} for a link to confirm the change.`)
      } else {
        await refetch()
        await utils.account.providers.invalidate()
        toast("Email updated.")
      }
    },
    onError: (error) => toast(error.message || "Couldn't change your email."),
  })

  const description = hasPassword
    ? currentEmail
    : providers.includes("google")
      ? `${currentEmail} | Linked to your Google account`
      : `${currentEmail} | You sign in with magic links`

  return (
    <MethodRow
      action={
        hasPassword && !editing ? (
          <Button
            onClick={() => {
              setValue(currentEmail)
              setEditing(true)
            }}
            size="sm"
            variant="outline"
          >
            Change
          </Button>
        ) : undefined
      }
      description={description}
      icon={<EnvelopeSimpleIcon className="size-5" />}
      title="Email"
    >
      {editing && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            changeEmail.mutate({ newEmail: value })
          }}
        >
          <Input
            autoFocus
            className="h-7 w-56 text-xs"
            maxLength={254}
            onChange={(e) => setValue(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={value}
          />
          <Button
            disabled={changeEmail.isPending || !value || value === currentEmail}
            size="sm"
            type="submit"
          >
            {changeEmail.isPending ? <Spinner /> : "Save"}
          </Button>
          <Button
            disabled={changeEmail.isPending}
            onClick={() => {
              setEditing(false)
              setValue(currentEmail)
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        </form>
      )}
    </MethodRow>
  )
}

function PasswordRow({ hasPassword }: { hasPassword: boolean }) {
  const [editing, setEditing] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setEditing(false)
    setCurrent("")
    setNext("")
    setConfirm("")
    setError(null)
  }

  const changePassword = trpc.account.changePassword.useMutation({
    onSuccess: () => {
      reset()
      toast("Password updated.")
    },
    onError: (e) => setError(e.message || "Couldn't change your password."),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    if (next !== confirm) {
      setError("Passwords don't match.")
      return
    }
    changePassword.mutate({ currentPassword: current, newPassword: next })
  }

  return (
    <MethodRow
      action={
        hasPassword && !editing ? (
          <Button onClick={() => setEditing(true)} size="sm" variant="outline">
            Change
          </Button>
        ) : undefined
      }
      description={
        hasPassword
          ? "••••••••••••"
          : "Not set | You sign in without a password"
      }
      icon={<LockKeyIcon className="size-5" />}
      title="Password"
    >
      {editing && (
        <form className="flex max-w-xs flex-col gap-2" onSubmit={submit}>
          <Input
            autoComplete="current-password"
            className="h-7 text-xs"
            maxLength={128}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            type="password"
            value={current}
          />
          <Input
            autoComplete="new-password"
            className="h-7 text-xs"
            maxLength={128}
            onChange={(e) => setNext(e.target.value)}
            placeholder="New password"
            type="password"
            value={next}
          />
          <Input
            autoComplete="new-password"
            className="h-7 text-xs"
            maxLength={128}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            value={confirm}
          />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              disabled={
                changePassword.isPending || !(current && next && confirm)
              }
              size="sm"
              type="submit"
            >
              {changePassword.isPending ? <Spinner /> : "Save"}
            </Button>
            <Button
              disabled={changePassword.isPending}
              onClick={reset}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </MethodRow>
  )
}

function GoogleRow({ hasGoogle }: { hasGoogle: boolean }) {
  const { refetch } = useAuthActions()
  const utils = trpc.useUtils()

  const linkGoogle = trpc.account.linkGoogle.useMutation({
    onSuccess: ({ url }) => {
      if (url) {
        window.location.href = url
      }
    },
    onError: (e) => toast(e.message || "Couldn't link Google."),
  })

  const unlink = trpc.account.unlinkProvider.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.account.providers.invalidate(), refetch()])
      toast("Google disconnected.")
    },
    onError: (e) => toast(e.message || "Couldn't unlink Google."),
  })

  const busy = linkGoogle.isPending || unlink.isPending

  return (
    <MethodRow
      action={
        hasGoogle ? (
          <Button
            disabled={busy}
            onClick={() => unlink.mutate({ providerId: "google" })}
            size="sm"
            variant="outline"
          >
            {unlink.isPending ? <Spinner /> : "Disconnect"}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => linkGoogle.mutate()} size="sm">
            {linkGoogle.isPending ? <Spinner /> : "Connect"}
          </Button>
        )
      }
      description={
        hasGoogle
          ? "Connected — sign in with Google"
          : "Connect for one-tap sign-in"
      }
      icon={<GoogleLogoIcon className="size-5" weight="bold" />}
      title="Google"
    />
  )
}
