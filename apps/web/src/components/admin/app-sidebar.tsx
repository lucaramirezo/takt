'use client'

import { ClockCounterClockwise, Users, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { client } from '@/lib/orpc'

export function AppSidebar() {
  const pathname = usePathname()
  const [detectedCount, setDetectedCount] = useState<number | null>(null)

  // Live count of detected exceptions for the nav badge. Best-effort: hidden on any error (e.g. an
  // employee who lacks irregularity:read gets a 403, swallowed). Reflects total detected, not per-user
  // acknowledged state (acknowledgement is page-local this milestone).
  useEffect(() => {
    let cancelled = false
    client.time.irregularity
      .list({})
      .then((r) => {
        if (!cancelled) setDetectedCount(r.counts.total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <span className="font-heading text-lg font-semibold tracking-tight">
          takt<span className="text-primary">.</span>
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin'}>
                  <Link href="/admin"><Users /><span>Roster</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/timesheets')}>
                  <Link href="/admin/timesheets"><ClockCounterClockwise /><span>Timesheets</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/exceptions')}>
                  <Link href="/admin/exceptions">
                    <WarningCircle />
                    <span>Exceptions</span>
                    {detectedCount != null && detectedCount > 0 && (
                      <span
                        className="ml-auto rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums"
                        style={{ background: 'var(--danger)', color: 'var(--primary-foreground)' }}
                      >
                        {detectedCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
