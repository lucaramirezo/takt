/**
 * takt design tokens: the single source of truth feeding shadcn-on-web and NativeWind-on-native.
 * Direction: "Precision / Takt Grid" on the shadcn `luma` preset.
 * Full spec: lwiki artifact drafts/artifacts/2026-06-04/takt/design/design-system.md
 *
 * accent (andon orange) is cadence/live/CTA ONLY, never used for "warning".
 */

export const colors = {
  light: {
    background: '#FBFAF8', // warm paper, never sterile white
    surface: '#FFFFFF',
    surfaceAlt: '#F4F2ED',
    border: '#E4E0D8',
    foreground: '#1A1916', // near-black warm ink (also the primary)
    mutedForeground: '#6B675E',
    primary: '#1A1916',
    primaryForeground: '#FBFAF8',
    accent: '#E8590C', // andon orange: live / CTA / focus only
    success: '#2F7D54',
    warning: '#B86E00',
    danger: '#C0392B',
  },
  dark: {
    background: '#16150F', // warm-charcoal cockpit
    surface: '#211F18',
    surfaceAlt: '#2B281F',
    border: 'rgba(255,255,255,0.09)',
    foreground: '#F4F2ED',
    mutedForeground: '#A39E92',
    primary: '#F4F2ED', // ink flips to off-white in dark
    primaryForeground: '#16150F',
    accent: '#FF7A30',
    success: '#54C08A',
    warning: '#E0A030',
    danger: '#F0685A',
  },
} as const

export const fonts = {
  heading: 'Space Grotesk', // labels, nav, KPI numerics, kiosk clock
  body: 'Inter',
  mono: 'JetBrains Mono', // ALL numerics, tabular
} as const

// Lean into the shadcn luma preset's rounded geometry. Precision lives in the data layer, not the corners.
export const radius = { sm: 4, md: 8, lg: 12, xl: 16 } as const

export const tokens = { colors, fonts, radius } as const
export type Tokens = typeof tokens
