import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'takt Kiosk',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'takt Kiosk' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#16150f',
}

export default function KioskLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh w-full overscroll-none touch-manipulation select-none">{children}</div>
}
