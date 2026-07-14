import { describe, it, expect } from 'vitest'
import { parseUrlState, buildUrlPath } from '../urlState'

const BASE = '/stocks-dashboard/'

describe('parseUrlState', () => {
  it('parses list and date from a full path', () => {
    expect(parseUrlState('/stocks-dashboard/nasdaq100/2026-07-13', BASE))
      .toEqual({ listId: 'nasdaq100', date: '2026-07-13' })
  })

  it('parses a list-only path', () => {
    expect(parseUrlState('/stocks-dashboard/sp500', BASE))
      .toEqual({ listId: 'sp500', date: undefined })
  })

  it('returns undefined fields for the bare base path', () => {
    expect(parseUrlState('/stocks-dashboard/', BASE))
      .toEqual({ listId: undefined, date: undefined })
    expect(parseUrlState('/stocks-dashboard', BASE))
      .toEqual({ listId: undefined, date: undefined })
  })

  it('rejects a malformed date segment', () => {
    expect(parseUrlState('/stocks-dashboard/ai-cake/not-a-date', BASE))
      .toEqual({ listId: 'ai-cake', date: undefined })
    expect(parseUrlState('/stocks-dashboard/ai-cake/2026-7-13', BASE))
      .toEqual({ listId: 'ai-cake', date: undefined })
  })

  it('falls back to stripping a leading slash when the path lacks the base prefix', () => {
    expect(parseUrlState('/nasdaq100/2026-07-13', BASE))
      .toEqual({ listId: 'nasdaq100', date: '2026-07-13' })
  })
})

describe('buildUrlPath', () => {
  it('joins base, list, and date with no double slashes', () => {
    expect(buildUrlPath(BASE, 'nasdaq100', '2026-07-13')).toBe('/stocks-dashboard/nasdaq100/2026-07-13')
  })

  it('round-trips through parseUrlState', () => {
    const path = buildUrlPath(BASE, 'sp500', '2025-01-01')
    expect(parseUrlState(path, BASE)).toEqual({ listId: 'sp500', date: '2025-01-01' })
  })
})
