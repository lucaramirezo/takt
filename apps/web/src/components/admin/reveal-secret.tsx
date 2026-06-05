'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
import { Eye, EyeSlash, Copy, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function RevealSecret({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard unavailable; the token stays visible for manual copy.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <AlertTitle>Copy this token now</AlertTitle>
        <AlertDescription>
          It will not be shown again. Store it somewhere safe before you close this dialog.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2">
        {revealed ? (
          <code className="flex-1 select-all rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
            {value}
          </code>
        ) : (
          <span
            aria-hidden="true"
            className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-widest text-muted-foreground"
          >
            {'•'.repeat(16)}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={revealed ? 'Hide token' : 'Reveal token'}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy token"
          onClick={handleCopy}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Token copied to clipboard' : ''}
      </span>
    </div>
  )
}
