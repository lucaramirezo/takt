import { redirect } from 'next/navigation'
import { serverClient } from '@/lib/orpc-server'
import { RosterTable } from '@/components/admin/roster-table'

export default async function AdminPage() {
  let me: Awaited<ReturnType<typeof serverClient.me>>
  try {
    me = await serverClient.me()
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') redirect('/login')
    throw err
  }
  if (me.role === 'employee') redirect('/clock')
  const roster = await serverClient.org.roster()
  const self = roster.find((r) => r.userId === me.userId)
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {self?.name ?? me.userId} ({me.role.replaceAll('_', ' ')})
        </p>
      </header>
      <RosterTable rows={roster} />
    </div>
  )
}
