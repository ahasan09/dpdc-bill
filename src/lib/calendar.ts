/** Builds a monthly recurring reminder as an .ics file (works with Google, Apple and Outlook calendars). */
export function buildReminderIcs(opts: {
  day: number
  title: string
  description: string
  url: string
  now?: Date
}): string {
  const now = opts.now ?? new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  // First occurrence: this month if the day hasn't passed yet, otherwise next month.
  let start = new Date(now.getFullYear(), now.getMonth(), opts.day)
  if (start < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    start = new Date(now.getFullYear(), now.getMonth() + 1, opts.day)
  }
  const date = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const next = new Date(start)
  next.setDate(next.getDate() + 1)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DPDC Bill Check//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@dpdc-bill-check`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date(start)}`,
    `DTEND;VALUE=DATE:${date(next)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${opts.day}`,
    `SUMMARY:${escape(opts.title)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `URL:${opts.url}`,
    'BEGIN:VALARM',
    'TRIGGER:PT9H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(opts.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
