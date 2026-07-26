import { useEffect, useState } from 'react'
import { StockDashboard } from './components/StockDashboard'
import { AboutPage } from './components/AboutPage'
import { StockDetailPage } from './components/StockDetailPage'

const BASE_PATH = import.meta.env.BASE_URL

function relPath(pathname: string): string {
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname.replace(/^\//, '')
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const rel = relPath(pathname)

  if (rel === 'about' || rel === 'about/') return <AboutPage />

  const stockMatch = rel.match(/^stock\/([A-Za-z.]+)\/?$/)
  if (stockMatch) return <StockDetailPage ticker={stockMatch[1].toUpperCase()} />

  return <StockDashboard />
}
