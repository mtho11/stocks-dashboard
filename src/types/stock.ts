export interface Stock {
  ticker: string
  company: string
  price: number
  marketCap: string
  ps: number | null
  pe: number | null
  pctYTD: number
  pct1Y: number
  deltaHighs: number
  rsRank: number
  sma1M: 'up' | 'down'
  sma20: 'up' | 'down'
  sma50: 'up' | 'down'
  sma200: 'up' | 'down'
  sparklineData: number[]
  color?: string
}
