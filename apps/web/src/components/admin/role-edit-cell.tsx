'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MemberRole, RosterRow } from '@takt/domain'
import { client } from '@/lib/orpc'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function RoleEditCell({ row, meRole }: { row: RosterRow; meRole: MemberRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<MemberRole>(row.role)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (meRole === 'people_manager' && row.role === 'owner') return null

  function handleOpen(next: boolean) {
    setOpen(next)
    if (next) {
      setRole(row.role)
      setError(null)
    }
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await client.org.member.setRole({ memberId: row.memberId, role })
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError((err as { message?: string }).message ?? 'Could not change role')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Edit role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit role for {row.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-select">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger id="role-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meRole === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="people_manager">People manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={handleConfirm} disabled={pending}>
              {pending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
