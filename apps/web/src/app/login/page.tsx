'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noOrg, setNoOrg] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setNoOrg(false); setPending(true)
    try {
      const signIn = await authClient.signIn.email({ email, password })
      if (signIn.error) { setError(signIn.error.message ?? 'Sign in failed'); return }
      const session = await authClient.getSession()
      let activeOrg = session.data?.session.activeOrganizationId ?? null
      if (!activeOrg) {
        const list = await authClient.organization.list()
        const firstOrg = (list.data ?? [])[0]
        if (!firstOrg) { setNoOrg(true); return }
        // MVP stopgap: a worker in 2+ orgs gets the first. TODO: real org picker (deferred).
        activeOrg = firstOrg.id
        await authClient.organization.setActive({ organizationId: activeOrg })
      }
      router.push('/clock')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        takt<span style={{ color: 'var(--accent)' }}>.</span>
      </h1>
      <p className="mt-1 mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Sign in to clock in.</p>
      {noOrg ? (
        <p className="text-sm" style={{ color: 'var(--warning)' }}>
          You are not part of an organization yet. Please contact your manager.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="email" required placeholder="Email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Input
            type="password" required placeholder="Password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.currentTarget.value)}
          />
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button type="submit" disabled={pending} size="lg" className="mt-1">
            {pending ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      )}
    </main>
  )
}
