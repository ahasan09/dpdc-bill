/**
 * Turns the text of a DPDC bill PDF into a summary.
 *
 * Built without a real sample bill, so it does not rely on positions. It looks
 * for the usual English and Bangla labels ("Net Payable", "মোট দেয়", "Due Date",
 * "পরিশোধের শেষ তারিখ", …) and reads the value on the same line or the next one.
 * DPDC's own file name (ebill_<customer no>_<Month>_<Year>.pdf) is used as a
 * reliable source for the customer number and month. Every field may be missing;
 * the review step lets the user fill or fix it before saving.
 */

export interface ParsedBill {
  customerNo: string | null
  year: number | null
  month: number | null
  /** Total payable in taka. */
  amount: number | null
  /** Units consumed (kWh). */
  units: number | null
  /** ISO yyyy-mm-dd */
  dueDate: string | null
  /** Why the text could not be read well, if we can tell. */
  warning: 'noText' | 'unreadableBangla' | null
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

export function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
}

const CONSONANT = '[\u0995-\u09B9\u09DC-\u09DF\u09CE]'
const CLUSTER = `${CONSONANT}(?:\u09BC)?(?:\u09CD${CONSONANT}(?:\u09BC)?)*`

/**
 * Repairs Bangla text as PDFs usually give it back: pre-base vowel signs
 * (ি ে ৈ) in visual order before their consonant, split ো/ৌ, and empty
 * characters for glyphs without a Unicode mapping.
 */
export function repairBangla(text: string): string {
  // A glyph without a Unicode mapping comes back as \u0000. At the start of a word
  // before a consonant it is almost always ে (drawn first); elsewhere it is an
  // unmappable conjunct and is dropped.
  const cleaned = text
    .replace(new RegExp(`(^|[^\\u0980-\\u09FF])\\u0000(?=${CONSONANT})`, 'gm'), '$1\u09C7')
    // eslint-disable-next-line no-control-regex -- \u0000 is what pdf.js returns for unmapped glyphs
    .replace(/\u0000/g, '')
  // In correctly ordered Bangla these signs never start a word; in visual order they often do.
  const visual = (cleaned.match(/(?:^|[^\u0980-\u09FF])[\u09BF\u09C7\u09C8]/gm) ?? []).length >= 2
  if (!visual) return cleaned.normalize('NFC')
  return cleaned
    .replace(new RegExp(`([\u09BF\u09C7\u09C8])(${CLUSTER})`, 'g'), '$2$1')
    .replace(/\u09C7\u09BE/g, '\u09CB') // ে + া → ো
    .replace(/\u09C7\u09D7/g, '\u09CC') // ে + ৗ → ৌ
    .normalize('NFC')
}

const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// Stems that cover the common spellings (জানুয়ারি/জানুয়ারী, আগস্ট/অগাস্ট/আগষ্ট …).
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', '(?:আগ|অগা)', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে']

function monthFromWord(word: string): number | null {
  const w = word.toLowerCase()
  const en = EN_MONTHS.findIndex((m) => w.startsWith(m))
  if (en >= 0) return en + 1
  const bn = BN_MONTHS.findIndex((m) => new RegExp(`^${m}`).test(word))
  return bn >= 0 ? bn + 1 : null
}

const MONTH_WORD = `(${EN_MONTHS.map((m) => `${m}[a-z]*`).join('|')}|${BN_MONTHS.map((m) => `${m}[\\u0980-\\u09FF]*`).join('|')})`

/** "September 2026", "Sep-2026", "Sep'26", "সেপ্টেম্বর ২০২৬", "09/2026", "2026-09" */
export function findPeriod(text: string): { year: number; month: number } | null {
  const t = normalizeDigits(text)
  const named = new RegExp(`${MONTH_WORD}[\\s,'’\\-/.]*((?:20)?\\d{2})(?!\\d)`, 'i').exec(t)
  if (named) {
    const month = monthFromWord(named[1])
    const year = toYear(named[2])
    if (month && year) return { year, month }
  }
  const numeric = /(?<!\d)(0?[1-9]|1[0-2])[/\-.](20\d{2})(?!\d)/.exec(t)
  if (numeric) return { year: Number(numeric[2]), month: Number(numeric[1]) }
  const iso = /(?<!\d)(20\d{2})[/\-.](0[1-9]|1[0-2])(?![\d/\-.]\d)/.exec(t)
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) }
  return null
}

function toYear(y: string): number | null {
  const n = Number(y.length === 2 ? `20${y}` : y)
  return n >= 2008 && n <= 2100 ? n : null
}

/** "15-10-2026", "15/10/2026", "15 Oct 2026", "15-Oct-26", "১৫ অক্টোবর ২০২৬", "2026-10-15" */
export function findDate(text: string): string | null {
  const t = normalizeDigits(text)
  const iso = (y: number, m: number, d: number) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null

  let m = /(?<!\d)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(t)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.]((?:20)?\d{2})(?!\d)/.exec(t)
  if (m) {
    const year = toYear(m[3])
    if (year) return iso(year, Number(m[2]), Number(m[1]))
  }
  m = new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.]*${MONTH_WORD}[\\s,'’\\-/.]*((?:20)?\\d{2})(?!\\d)`, 'i').exec(t)
  if (m) {
    const month = monthFromWord(m[2])
    const year = toYear(m[3])
    if (month && year) return iso(year, month, Number(m[1]))
  }
  return null
}

/** Taka amounts: "Tk. 1,23,456.78", "৳ 2,345", "2345.00". Ignores things that look like dates. */
function findAmount(text: string): number | null {
  const t = normalizeDigits(text).replace(/(?<!\d)\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?!\d)/g, ' ')
  const m = /(?:৳|tk\.?|bdt|taka|টাকা)?\s*(-?\d{1,3}(?:,\d{2,3})+|-?\d+)(\.\d{1,2})?(?!\d)/i.exec(t)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, '') + (m[2] ?? ''))
  return Number.isFinite(n) ? n : null
}

function findUnits(text: string): number | null {
  const t = normalizeDigits(text)
  const m = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(?:kwh|units?|ইউনিট)?/i.exec(t)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, '') + (m[2] ?? ''))
  return Number.isFinite(n) ? n : null
}

type Finder<T> = (text: string) => T | null

/**
 * Finds the first line matching one of the labels (in priority order) and reads
 * the value after the label on that line, or on the next two lines.
 */
function labeled<T>(lines: string[], labels: RegExp[], find: Finder<T>): T | null {
  for (const label of labels) {
    for (let i = 0; i < lines.length; i++) {
      const match = label.exec(lines[i])
      if (!match) continue
      const rest = lines[i].slice(match.index + match[0].length)
      const value = find(rest) ?? find(lines[i + 1] ?? '') ?? find(lines[i + 2] ?? '')
      if (value !== null) return value
    }
  }
  return null
}

// Labels, most specific first. A total line must win over "Energy Charge" etc.
const AMOUNT_LABELS = [
  /net\s*payable|total\s*payable|payable\s*amount|amount\s*payable|amount\s*to\s*be\s*paid/i,
  /grand\s*total|total\s*bill(?:\s*amount)?|total\s*amount|bill\s*amount/i,
  /সর্বমোট|মোট\s*(?:প্রদেয়|প্রদেয়|দেয়|দেয়|পরিশোধযোগ্য|টাকা|বিল)|পরিশোধযোগ্য\s*(?:টাকা|অর্থ)?|প্রদেয়\s*(?:টাকা|অর্থ)|প্রদেয়\s*(?:টাকা|অর্থ)/,
  /(?<![a-z])total(?![a-z])/i,
]
const UNIT_LABELS = [
  /(?:units?\s*consumed|consumed\s*units?|total\s*(?:units?|consumption)|net\s*units?|billed\s*units?|energy\s*consumed|consumption)/i,
  /ব্যবহৃত\s*(?:ইউনিট|বিদ্যুৎ)|মোট\s*ইউনিট|বিলকৃত\s*ইউনিট|ইউনিট/,
  /kwh/i,
]
const DUE_LABELS = [
  /due\s*date|last\s*date(?:\s*of\s*payment)?|pay\s*by|payment\s*due/i,
  /পরিশোধের\s*শেষ\s*তারিখ|শেষ\s*তারিখ|পরিশোধের\s*তারিখ/,
]
const MONTH_LABELS = [/bill(?:ing)?\s*(?:month|period)|month\s*of\s*bill/i, /বিলের\s*মাস|বিল\s*মাস|মাস/]
const CUSTOMER_LABELS = [
  /customer\s*(?:no|number|id)|consumer\s*(?:no|number)|account\s*(?:no|number)/i,
  /কাস্টমার\s*(?:নং|নম্বর|নাম্বার)|গ্রাহক\s*(?:নং|নম্বর|নাম্বার)|হিসাব\s*নম্বর/,
]

const FILE_NAME = /ebill[_\-\s]*(\d{6,12})[_\-\s]*([a-z]+)[_\-\s]*(\d{4})/i

function digitsOnly(text: string): string | null {
  const m = /(?<!\d)(\d{6,12})(?!\d)/.exec(normalizeDigits(text))
  return m ? m[1] : null
}

/**
 * Legacy (non-Unicode) Bangla fonts such as SutonnyMJ come out as Latin-1
 * gibberish ("‡gvU UvKv"). If a lot of the letters look like that, say so.
 */
function looksLikeLegacyBangla(text: string): boolean {
  const letters = text.replace(/[\s\d.,:;\-/()]/g, '')
  if (letters.length < 40) return false
  const odd = (letters.match(/[À-ÿ‘-‡ˆ‹›ŒœŠšŸŽž]/g) ?? []).length
  const bangla = (letters.match(/[ঀ-৿]/g) ?? []).length
  return odd / letters.length > 0.08 && bangla < odd
}

export function parseBillText(
  text: string,
  opts: { fileName?: string; knownCustomerNos?: string[] } = {},
): ParsedBill {
  // Repair Bangla, make digits ASCII, then join Bangla letters that a PDF split with
  // spaces ("কাস্ট মার নম্ব র"); labels allow optional spaces, so they still match.
  text = normalizeDigits(repairBangla(text))
  const lines = text
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/\s+/g, ' ')
        .replace(/([\u0980-\u09FF]) (?=[\u0980-\u09FF])/g, '$1')
        .trim(),
    )
    .filter(Boolean)
  const normalized = normalizeDigits(text)

  const fromFile = opts.fileName ? FILE_NAME.exec(opts.fileName) : null
  const fileMonth = fromFile ? monthFromWord(fromFile[2]) : null
  const fileYear = fromFile ? toYear(fromFile[3]) : null

  // Customer number: a saved number seen in the text beats a label match, which beats the file name.
  const known = (opts.knownCustomerNos ?? []).find((no) => new RegExp(`(?<!\\d)${no}(?!\\d)`).test(normalized))
  const customerNo = known ?? labeled(lines, CUSTOMER_LABELS, digitsOnly) ?? fromFile?.[1] ?? null

  // Month: the file name is authoritative; then a labelled "Bill Month"; then the first month/year in the text.
  const period =
    fileMonth && fileYear
      ? { year: fileYear, month: fileMonth }
      : (labeled(lines, MONTH_LABELS, findPeriod) ?? findPeriod(lines.slice(0, 40).join('\n')))

  const warning = lines.length === 0 ? 'noText' : looksLikeLegacyBangla(text) ? 'unreadableBangla' : null

  return {
    customerNo,
    year: period?.year ?? null,
    month: period?.month ?? null,
    amount: labeled(lines, AMOUNT_LABELS, findAmount),
    units: labeled(lines, UNIT_LABELS, findUnits),
    dueDate: labeled(lines, DUE_LABELS, findDate),
    warning,
  }
}
