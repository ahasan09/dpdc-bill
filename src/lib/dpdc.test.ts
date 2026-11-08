import { describe, expect, it } from 'vitest'
import {
  availableYears,
  buildBillUrl,
  currentPeriod,
  isBillNotReady,
  isFuturePeriod,
  latestBillPeriod,
  normalizeCustomerNo,
  shiftPeriod,
  validateCustomerNo,
} from './dpdc'

describe('normalizeCustomerNo', () => {
  it('converts Bangla digits and strips separators', () => {
    expect(normalizeCustomerNo('১২৩৪ ৫৬-৭৮')).toBe('12345678')
  })
})

describe('validateCustomerNo', () => {
  it('accepts an 8-digit number', () => {
    expect(validateCustomerNo('12345678')).toBeNull()
  })
  it('rejects empty, letters and wrong lengths', () => {
    expect(validateCustomerNo('  ')).toBe('empty')
    expect(validateCustomerNo('1234abcd')).toBe('notDigits')
    expect(validateCustomerNo('123')).toBe('length')
    expect(validateCustomerNo('1234567890123')).toBe('length')
  })
})

describe('buildBillUrl', () => {
  it('builds the official pre-filled URL without a security code', () => {
    const url = new URL(
      buildBillUrl({ billType: 'current', year: 2026, month: 3, customerNo: '১২৩৪৫৬৭৮' }),
    )
    expect(url.origin + url.pathname).toBe('https://dpdc.org.bd/site/service/ebill_gov')
    expect(url.searchParams.get('btyp')).toBe('current')
    expect(url.searchParams.get('year')).toBe('2026')
    expect(url.searchParams.get('month')).toBe('03')
    expect(url.searchParams.get('cno')).toBe('12345678')
    expect(url.searchParams.get('email')).toBe('')
    expect(url.searchParams.has('security_code')).toBe(false)
  })
  it('includes a trimmed email when given', () => {
    const url = new URL(
      buildBillUrl({
        billType: 'summary',
        year: 2025,
        month: 12,
        customerNo: '12345678',
        email: ' me@example.com ',
      }),
    )
    expect(url.searchParams.get('email')).toBe('me@example.com')
  })
})

describe('periods', () => {
  const now = new Date(2026, 0, 15) // 15 Jan 2026
  it('gets the current period', () => {
    expect(currentPeriod(now)).toEqual({ year: 2026, month: 1 })
  })
  it('shifts across year boundaries', () => {
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftPeriod({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 })
    expect(shiftPeriod({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 })
  })
  it('detects future periods', () => {
    expect(isFuturePeriod({ year: 2026, month: 2 }, now)).toBe(true)
    expect(isFuturePeriod({ year: 2026, month: 1 }, now)).toBe(false)
  })
  it('lists years newest first back to 2008', () => {
    const years = availableYears(now)
    expect(years[0]).toBe(2026)
    expect(years.at(-1)).toBe(2008)
  })
})

describe('bill availability', () => {
  it('treats last month as ready from the 8th', () => {
    expect(latestBillPeriod(new Date(2026, 10, 8))).toEqual({ year: 2026, month: 10 })
    expect(latestBillPeriod(new Date(2026, 10, 30))).toEqual({ year: 2026, month: 10 })
  })

  it('falls back two months before the 8th, across the year boundary', () => {
    expect(latestBillPeriod(new Date(2026, 10, 7))).toEqual({ year: 2026, month: 9 })
    expect(latestBillPeriod(new Date(2027, 0, 3))).toEqual({ year: 2026, month: 11 })
  })

  it('flags months whose bill is not generated yet', () => {
    const now = new Date(2026, 10, 5)
    expect(isBillNotReady({ year: 2026, month: 10 }, now)).toBe(true)
    expect(isBillNotReady({ year: 2026, month: 9 }, now)).toBe(false)
  })
})
