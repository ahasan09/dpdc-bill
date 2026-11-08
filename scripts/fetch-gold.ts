/**
 * Reads the gold prices (see KARATS) from bajus.org and writes public/gold.json.
 * The file only changes when a price changes, so the sync job commits (and
 * redeploys) only then. Exits non-zero if the page can't be read.
 *
 * Run: node scripts/fetch-gold.ts   (or npm run gold to also commit and push)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { BAJUS_URL, KARATS, parseBajusPerGram, perVori, sanitizeGoldPrices } from '../src/lib/gold.ts'

const FILE = new URL('../public/gold.json', import.meta.url)

const res = await fetch(BAJUS_URL, { headers: { 'User-Agent': 'dpdc-bill gold price check' }, signal: AbortSignal.timeout(30000) })
if (!res.ok) throw new Error(`bajus.org answered ${res.status}`)
const html = await res.text()
const prices = KARATS.map((karat) => {
  const perGram = parseBajusPerGram(html, karat)
  if (perGram === null) throw new Error(`Couldn't find the ${karat}K price on ${BAJUS_URL}; the page layout may have changed.`)
  return { karat, perGram, perVori: perVori(perGram) }
})

let previous = null
try {
  previous = sanitizeGoldPrices(JSON.parse(readFileSync(FILE, 'utf8')))
} catch {
  /* first run */
}

const describe = (list: { karat: number; perGram: number }[]) => list.map((p) => `${p.karat}K ${p.perGram}`).join(', ')
const same =
  previous !== null &&
  previous.prices.length === prices.length &&
  prices.every((p, i) => previous.prices[i].karat === p.karat && previous.prices[i].perGram === p.perGram)

if (same) {
  console.log(`Unchanged: ${describe(prices)} BDT/gram since ${previous!.since}`)
} else {
  writeFileSync(FILE, JSON.stringify({ prices, since: new Date().toISOString(), source: BAJUS_URL }, null, 2) + '\n')
  console.log(`Updated: ${previous ? describe(previous.prices) : '—'} → ${describe(prices)} BDT/gram`)
}
