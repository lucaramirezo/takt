'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
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
import { RevealSecret } from './reveal-secret'

export function RegisterDeviceDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setToken(null)
    setError(null)
  }

  function handleOpen(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const out = await client.device.register({ name: name.trim() })
        setToken(out.token)
      } catch (err) {
        setError((err as { message?: string }).message ?? 'Could not register device')
      }
    })
  }

  function handleAcknowledge() {
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Register device</Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={token === null}
        onEscapeKeyDown={(e) => { if (token !== null) e.preventDefault() }}
        onInteractOutside={(e) => { if (token !== null) e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>Register device</DialogTitle>
        </DialogHeader>
        {token === null ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Front desk tablet"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Registering...' : 'Register device'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <RevealSecret value={token} />
            <DialogFooter>
              <Button type="button" onClick={handleAcknowledge}>
                I have copied the token
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
