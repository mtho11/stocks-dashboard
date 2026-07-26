// Builds a minimal all-day .ics event and triggers a browser download —
// no server round-trip, just a Blob URL clicked via a throwaway <a>.
export function downloadIcsEvent(filename: string, summary: string, dateStr: string, description?: string) {
  const dt = dateStr.replace(/-/g, '')
  const end = new Date(`${dateStr}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 1)
  const dtEnd = end.toISOString().slice(0, 10).replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const uid = `${dt}-${summary.replace(/\s+/g, '-')}@stocks-dashboard`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//stocks-dashboard//earnings//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${summary}`,
  ]
  if (description) lines.push(`DESCRIPTION:${description}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
