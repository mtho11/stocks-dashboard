export interface NewsLink {
  source: string
  label: string
  url: string
}

// This app has no live news feed (and, being a static site, no safe place to
// hold a news-API key client-side), so rather than fabricate headlines —
// which would misrepresent invented text as real financial news — this
// links out to each site's actual ticker-specific news page. Real,
// working links; just not pre-fetched article titles.
const NEWS_SOURCES: { source: string; urlFor: (ticker: string) => string }[] = [
  { source: 'Yahoo Finance', urlFor: t => `https://finance.yahoo.com/quote/${t}/news` },
  { source: 'MarketWatch', urlFor: t => `https://www.marketwatch.com/investing/stock/${t.toLowerCase()}` },
  { source: 'Seeking Alpha', urlFor: t => `https://seekingalpha.com/symbol/${t}/news` },
  { source: 'Benzinga', urlFor: t => `https://www.benzinga.com/quote/${t}` },
  { source: 'Finviz', urlFor: t => `https://finviz.com/quote.ashx?t=${t}` },
  { source: 'StockTwits', urlFor: t => `https://stocktwits.com/symbol/${t}` },
  { source: 'Nasdaq', urlFor: t => `https://www.nasdaq.com/market-activity/stocks/${t.toLowerCase()}/news-headlines` },
  { source: 'TipRanks', urlFor: t => `https://www.tipranks.com/stocks/${t.toLowerCase()}/stock-news` },
  { source: 'CNBC', urlFor: t => `https://www.cnbc.com/quotes/${t}` },
  { source: 'Google News', urlFor: t => `https://news.google.com/search?q=${t}%20stock` },
]

export function getNewsLinks(ticker: string, companyName: string): NewsLink[] {
  return NEWS_SOURCES.map(({ source, urlFor }) => ({
    source,
    label: `${source} — latest news on ${companyName} (${ticker})`,
    url: urlFor(ticker),
  }))
}
