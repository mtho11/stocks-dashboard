export interface NewsHeadline {
  title: string
  source: string
  url: string
  pubDate: string
}

// Google News RSS has no CORS header, so a browser fetch from this app's own
// origin (a static GitHub Pages site with no backend) gets blocked reading
// the response. Routing through a public CORS-proxy mirror (allorigins.win)
// is the standard workaround for client-only sites — it's a free, unkeyed
// third party though, so callers should expect occasional failures and have
// a fallback.
const CORS_PROXY = 'https://api.allorigins.win/raw?url='

function stripSourceSuffix(rawTitle: string): { headline: string; source: string } {
  // Google News formats titles as "Headline - Source Name".
  const idx = rawTitle.lastIndexOf(' - ')
  if (idx === -1) return { headline: rawTitle, source: '' }
  return { headline: rawTitle.slice(0, idx), source: rawTitle.slice(idx + 3) }
}

export async function fetchStockNews(ticker: string, companyName: string, limit = 10): Promise<NewsHeadline[]> {
  const query = encodeURIComponent(`${companyName} ${ticker} stock`)
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
  const res = await fetch(`${CORS_PROXY}${encodeURIComponent(rssUrl)}`)
  if (!res.ok) throw new Error(`News request failed (${res.status})`)

  const xmlText = await res.text()
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('Failed to parse news feed')

  return Array.from(doc.querySelectorAll('item'))
    .slice(0, limit)
    .map(item => {
      const { headline, source } = stripSourceSuffix(item.querySelector('title')?.textContent ?? '')
      return {
        title: headline,
        source,
        url: item.querySelector('link')?.textContent ?? '',
        pubDate: item.querySelector('pubDate')?.textContent ?? '',
      }
    })
    .filter(item => item.title && item.url)
}
