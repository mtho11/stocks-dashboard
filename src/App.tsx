import { useEffect, useState } from 'react'
import { StockDashboard } from './components/StockDashboard'
import { AboutPage } from './components/AboutPage'

const BASE_PATH = import.meta.env.BASE_URL

function isAboutPath(pathname: string): boolean {
  const rel = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname.replace(/^\//, '')
  return rel === 'about' || rel === 'about/'
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return isAboutPath(pathname) ? <AboutPage /> : <StockDashboard />
}
