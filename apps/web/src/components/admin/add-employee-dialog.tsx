'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MemberRole } from '@takt/domain'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function AddEmployeeDialog({ meRole }: { meRole: MemberRole }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('employee')
  const [employmentType, setEmploymentType] = useState<'hourly' | 'salaried' | 'contractor'>('hourly')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await client.employee.create({
          name,
          role,
          employmentType,
          email: email.trim() ? email.trim() : undefined,
          pin: pin.trim() ? pin.trim() : undefined,
        })
        setOpen(false)
        setName('')
        setEmail('')
        setPin('')
        setRole('employee')
        setEmploymentType('hourly')
        router.refresh()
      } catch (err) {
        setError((err as { message?: string }).message ?? 'Could not create employee')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Add employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input
              id="emp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-email">Email (optional)</Label>
            <Input
              id="emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger id="emp-role" className="w-full">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-employment-type">Employment type</Label>
            <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as 'hourly' | 'salaried' | 'contractor')}>
              <SelectTrigger id="emp-employment-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="salaried">Salaried</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-pin">PIN (optional, 4 to 6 digits)</Label>
            <Input
              id="emp-pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-6 digit PIN"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding...' : 'Add employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
