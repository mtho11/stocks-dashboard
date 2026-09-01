import { useCallback, useEffect, useMemo, useState } from 'react'

export interface StockNewsItem {
  title: string
  link: string
  pubDate?: string
  source?: string
}

interface NewsState {
  ticker: string
  items: StockNewsItem[]
  error?: string
}

const MAX_ITEMS = 10
const RSS_ENDPOINT = 'https://api.rss2json.com/v1/api.json'

function googleNewsUrl(ticker: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} stock`)}&hl=en-US&gl=US&ceid=US:en`
}

function googleNewsSearchUrl(ticker: string): string {
  return `https://news.google.com/search?q=${encodeURIComponent(`${ticker} stock`)}&hl=en-US&gl=US&ceid=US:en`
}

function stripHtml(value: string): string {
  const el = document.createElement('div')
  el.innerHTML = value
  return el.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? undefined
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function useStockNews(ticker: string) {
  const [state, setState] = useState<NewsState | undefined>()
  const [requestKey, setRequestKey] = useState(0)

  const refresh = useCallback(() => setRequestKey(key => key + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const feed = googleNewsUrl(ticker)
    const endpoint = `${RSS_ENDPOINT}?rss_url=${encodeURIComponent(feed)}`

    fetch(endpoint, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`News request failed (${response.status})`)
        return response.json() as Promise<{ status?: string; items?: Array<{ title?: string; link?: string; pubDate?: string; author?: string; description?: string }> }>
      })
      .then(payload => {
        if (payload.status !== 'ok' || !payload.items) throw new Error('News feed unavailable')
        const items = payload.items
          .map(item => ({
            title: stripHtml(item.title ?? ''),
            link: item.link ?? '',
            pubDate: parseDate(item.pubDate),
            source: item.author || (item.description ? stripHtml(item.description).split(' - ')[0] : undefined),
          }))
          .filter(item => item.title && item.link)
          .slice(0, MAX_ITEMS)
        setState({ ticker, items })
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ ticker, items: [], error: error instanceof Error ? error.message : 'News feed unavailable' })
      })

    return () => controller.abort()
  }, [ticker, requestKey])

  const loading = !state || state.ticker !== ticker
  const items = !loading && state ? state.items : []
  const error = !loading && state ? state.error : undefined
  const searchUrl = useMemo(() => googleNewsSearchUrl(ticker), [ticker])

  return { items, loading, error, refresh, searchUrl }
}
