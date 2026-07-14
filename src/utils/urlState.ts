const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Path shape: {base}{listId}/{date}, e.g. "/stocks-dashboard/nasdaq100/2026-07-13".
// Parsing only validates format (enum membership, date shape) — range
// clamping (min/max date, valid list id) is the caller's job since it needs
// app state (today's date, the list registry) this module doesn't have.

export function parseUrlState(pathname: string, base: string): { listId?: string; date?: string } {
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base
  let rel: string
  if (pathname.startsWith(base)) rel = pathname.slice(base.length)
  else if (pathname === baseNoSlash) rel = ''
  else if (pathname.startsWith(`${baseNoSlash}/`)) rel = pathname.slice(baseNoSlash.length + 1)
  else rel = pathname.replace(/^\//, '')
  const [listId, date] = rel.split('/').filter(Boolean)
  return {
    listId: listId || undefined,
    date: date && DATE_RE.test(date) ? date : undefined,
  }
}

export function buildUrlPath(base: string, listId: string, date: string): string {
  return `${base}${listId}/${date}`
}
