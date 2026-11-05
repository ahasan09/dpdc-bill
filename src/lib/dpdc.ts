/**
 * Everything we know about the official DPDC postpaid bill page.
 *
 * The official page (a plain GET form) pre-fills bill type, year, month,
 * customer number and e-mail from the query string. Its security code is a
 * server-session captcha, and the site sends no CORS headers, so this app
 * cannot (and must not try to) fetch bills itself. Instead it builds a
 * ready-to-go link and the user only types the 5-character security code.
 */

export const DPDC_BILL_URL = 'https://dpdc.org.bd/site/service/ebill_gov'
export const DPDC_HOME_URL = 'https://dpdc.org.bd/'

/** `current` = e-bill, `summary` = ledger (payment history), `misc` = misc bill. */
export type BillType = 'current' | 'summary' | 'misc'
export const BILL_TYPES: readonly BillType[] = ['current', 'summary', 'misc']

/** The official form offers years from 2008. */
export const FIRST_YEAR = 2008

export const CUSTOMER_NO_MIN = 6
export const CUSTOMER_NO_MAX = 12

export interface Period {
  year: number
  /** 1–12 */
  month: number
}

export interface BillQuery extends Period {
  billType: BillType
  customerNo: string
  email?: string
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

/** Accepts Bangla digits, spaces and dashes; returns ASCII digits only where possible. */
export function normalizeCustomerNo(input: string): string {
  return input
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[\s\-–—_.]/g, '')
}

export type CustomerNoError = 'empty' | 'notDigits' | 'length'

export function validateCustomerNo(raw: string): CustomerNoError | null {
  const value = normalizeCustomerNo(raw)
  if (value === '') return 'empty'
  if (!/^\d+$/.test(value)) return 'notDigits'
  if (value.length < CUSTOMER_NO_MIN || value.length > CUSTOMER_NO_MAX) return 'length'
  return null
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function buildBillUrl(query: BillQuery): string {
  const params = new URLSearchParams({
    btyp: query.billType,
    year: String(query.year),
    month: String(query.month).padStart(2, '0'),
    cno: normalizeCustomerNo(query.customerNo),
    email: query.email?.trim() ?? '',
  })
  return `${DPDC_BILL_URL}?${params.toString()}`
}

export function currentPeriod(now: Date = new Date()): Period {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function shiftPeriod(period: Period, deltaMonths: number): Period {
  const index = period.year * 12 + (period.month - 1) + deltaMonths
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function comparePeriods(a: Period, b: Period): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

export function isFuturePeriod(period: Period, now: Date = new Date()): boolean {
  return comparePeriods(period, currentPeriod(now)) > 0
}

export function availableYears(now: Date = new Date()): number[] {
  const years: number[] = []
  for (let y = now.getFullYear(); y >= FIRST_YEAR; y--) years.push(y)
  return years
}
