/**
 * Bangladesh gold price as set by BAJUS (Bangladesh Jewellers Association).
 *
 * bajus.org sends no CORS headers, so the browser can't read it. A scheduled
 * scheduled job on a Mac (scripts/sync-gold.sh → scripts/fetch-gold.ts) reads
 * the page and publishes gold.json next to the app; the card reads that file.
 */

export const BAJUS_URL = 'https://www.bajus.org/gold-price'

/** 1 vori (ভরি) = 16 ana = 11.664 g */
export const GRAMS_PER_VORI = 11.664

/** Karats shown in the card, highest first. */
export const KARATS = [22, 21] as const

export interface KaratPrice {
  karat: number
  /** taka per gram, as BAJUS lists it */
  perGram: number
  /** taka per vori, rounded */
  perVori: number
}

export interface GoldPrices {
  prices: KaratPrice[]
  /** ISO time these prices were first seen on bajus.org */
  since: string
  source: string
}

/** Reads "21 KARAT Gold … 18,580 BDT/GRAM" from the BAJUS page. Returns null if the layout changed. */
export function parseBajusPerGram(html: string, karat: number): number | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  const match = new RegExp(`\\b${karat} KARAT Gold\\b.{0,200}?([\\d,]+(?:\\.\\d+)?) BDT/GRAM`, 'i').exec(text)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ''))
  // Sanity range so a layout change can't publish nonsense.
  return Number.isFinite(value) && value >= 1000 && value <= 200000 ? value : null
}

export function perVori(perGram: number): number {
  return Math.round(perGram * GRAMS_PER_VORI)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const toKaratPrice = (v: unknown): KaratPrice | null =>
  isObj(v) && typeof v.karat === 'number' && typeof v.perGram === 'number' && v.perGram > 0
    ? { karat: v.karat, perGram: v.perGram, perVori: perVori(v.perGram) }
    : null

/** Defensive parse of gold.json. Also reads the older single-price file ({ karat, perGram, … }). */
export function sanitizeGoldPrices(raw: unknown): GoldPrices | null {
  if (!isObj(raw)) return null
  const list = Array.isArray(raw.prices) ? raw.prices : [raw]
  const prices = list
    .map(toKaratPrice)
    .filter((p): p is KaratPrice => p !== null)
    .sort((a, b) => b.karat - a.karat)
  const { since, source } = raw
  if (!prices.length || typeof since !== 'string' || Number.isNaN(Date.parse(since))) return null
  return {
    prices,
    since,
    source: typeof source === 'string' && /^https:\/\//.test(source) ? source : BAJUS_URL,
  }
}
