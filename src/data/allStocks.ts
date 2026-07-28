import { stocks as aiCakeStocks } from './stocks'
import { nasdaq100 } from './nasdaq100'
import { dji } from './dji'
import { finance } from './finance'
import { oil } from './oil'
import { healthcare } from './healthcare'
import { biotech } from './biotech'
import { retail } from './retail'
import { ia12 } from './ia12'
import type { Stock } from '../types/stock'

// Every stock across the built-in lists, keyed by ticker — lets a custom
// list (or the stock detail page) pull any stock regardless of which
// built-in list it "lives" in. First list wins on overlap; the shared
// tickers were kept numerically consistent across files anyway.
export const ALL_STOCKS_BY_TICKER: Record<string, Stock> = {}
for (const list of [aiCakeStocks, nasdaq100, dji, finance, oil, healthcare, biotech, retail, ia12]) {
  for (const s of list) {
    if (!(s.ticker in ALL_STOCKS_BY_TICKER)) ALL_STOCKS_BY_TICKER[s.ticker] = s
  }
}
export const ALL_TICKERS = Object.keys(ALL_STOCKS_BY_TICKER).sort()
