/**
 * Reads the 21K gold price from bajus.org and writes public/gold.json.
 * The file only changes when the price changes, so the scheduled workflow
 * commits (and redeploys) only then. Exits non-zero if the page can't be read.
 *
 * Run: node scripts/fetch-gold.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { BAJUS_URL, parseBajusPerGram, perVori, sanitizeGoldPrice } from '../src/lib/gold.ts'

const FILE = new URL('../public/gold.json', import.meta.url)
const KARAT = 21

const res = await fetch(BAJUS_URL, { headers: { 'User-Agent': 'dpdc-bill gold price check' }, signal: AbortSignal.timeout(30000) })
if (!res.ok) throw new Error(`bajus.org answered ${res.status}`)
const perGram = parseBajusPerGram(await res.text(), KARAT)
if (perGram === null) throw new Error(`Couldn't find the ${KARAT}K price on ${BAJUS_URL}; the page layout may have changed.`)

let previous = null
try {
  previous = sanitizeGoldPrice(JSON.parse(readFileSync(FILE, 'utf8')))
} catch {
  /* first run */
}

if (previous?.karat === KARAT && previous.perGram === perGram) {
  console.log(`Unchanged: ${perGram} BDT/gram since ${previous.since}`)
} else {
  const next = { karat: KARAT, perGram, perVori: perVori(perGram), since: new Date().toISOString(), source: BAJUS_URL }
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n')
  console.log(`Updated: ${previous?.perGram ?? '—'} → ${perGram} BDT/gram`)
}
