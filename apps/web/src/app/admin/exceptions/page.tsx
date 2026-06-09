import { redirect } from 'next/navigation'
import { serverClient } from '@/lib/orpc-server'
import { ExceptionsInbox } from '@/components/admin/exceptions-inbox'

export default async function ExceptionsPage() {
  let me: Awaited<ReturnType<typeof serverClient.me>>
  try {
    me = await serverClient.me()
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') redirect('/login')
    throw err
  }
  if (me.role === 'employee') redirect('/clock')

  const data = await serverClient.time.irregularity.list({})

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Exceptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Punches that need a second look, detected automatically</p>
        </div>
      </header>
      <ExceptionsInbox irregularities={data.irregularities} counts={data.counts} />
    </div>
  )
}
