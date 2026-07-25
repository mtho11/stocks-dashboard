export const THEME_KEY = 'stocks-dashboard-theme'

export const THEMES = {
  dark: {
    pageBg: '#0a0a0f',
    panelBg: '#0d1117',
    panelBg2: '#0f1419',
    hoverBg: '#1a202c',
    borderOuter: '#1a202c',
    borderInner: '#161b22',
    borderControl: '#2d3748',
    textMuted: '#4a5568',
    textSecondary: '#718096',
    textPrimary: '#e2e8f0',
    inputBg: '#161b22',
    gradient: 'linear-gradient(135deg, #90cdf4 0%, #68d391 50%, #f6ad55 100%)',
  },
  light: {
    pageBg: '#f3f4f7',
    panelBg: '#ffffff',
    panelBg2: '#f8f9fb',
    hoverBg: '#eef1f6',
    borderOuter: '#e2e5eb',
    borderInner: '#edeef2',
    borderControl: '#d5d9e0',
    textMuted: '#64748b',
    textSecondary: '#475569',
    textPrimary: '#1a202c',
    inputBg: '#ffffff',
    gradient: 'linear-gradient(135deg, #2b6cb0 0%, #2f855a 50%, #c05621 100%)',
  },
} as const

export type ThemeMode = 'dark' | 'light'
export type Theme = (typeof THEMES)[ThemeMode]

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Darkens a pastel/light hex color so it reads on a light background.
export function darken(hex: string, amt = 0.42): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (v: number) => Math.round(v * (1 - amt)).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}
