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
  /** Total payable by the due date, taka. */
  amount: number | null
  /** Total payable after the due date, taka. */
  lateAmount: number | null
  /** Units consumed (kWh). */
  units: number | null
  /** বর্তমান রিডিং — meter reading at the end of the period. */
  presentReading: number | null
  /** পূর্ববর্তী রিডিং — meter reading at the start of the period. */
  previousReading: number | null
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

/** All taka amounts in a text, in order: "Tk. 1,23,456.78", "৳ 2,345", "2345.00". Dates are ignored. */
function amountsIn(text: string): number[] {
  const t = normalizeDigits(text).replace(/(?<!\d)\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?!\d)/g, ' ')
  const out: number[] = []
  for (const m of t.matchAll(/(?<![\d.])(-?\d{1,3}(?:,\d{2,3})+|-?\d+)(\.\d{1,2})?(?![\d,])/g)) {
    const n = Number(m[1].replace(/,/g, '') + (m[2] ?? ''))
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/**
 * The amount after a total label. When two totals sit side by side (pay by the
 * due date / pay after it), the smaller one is the amount due by the due date:
 * the late amount only ever adds a surcharge.
 */
function findAmount(text: string): number | null {
  const [a, b] = amountsIn(text)
  if (a === undefined) return null
  if (b !== undefined && a > 0 && b > 0 && Math.max(a, b) / Math.min(a, b) <= 1.25) return Math.min(a, b)
  return a
}

function findUnits(text: string): number | null {
  const t = normalizeDigits(text)
  const m = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(?:kwh|units?|ইউনিট)?/i.exec(t)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, '') + (m[2] ?? ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Bangla "skeleton": the text without vowel signs and other marks. Bill fonts
 * often drop or reorder those (শেষ → শষ, পরিশোধের → পিরেশােধর), but the main
 * letters survive, so labels are matched on skeletons. `map` points each
 * skeleton character back to its position in the original line.
 */
const MARKS = /[ঁ-ঃ়া-্ৗ]/g
function skeletonOf(line: string): { s: string; map: number[] } {
  let s = ''
  const map: number[] = []
  for (let i = 0; i < line.length; i++) {
    if (/[ঁ-ঃ়া-্ৗ]/.test(line[i])) continue
    s += line[i]
    map.push(i)
  }
  return { s, map }
}
/** Writes a label regex normally; matching happens on skeletons. */
/**
 * Turns a normally spelled Bangla label into a skeleton pattern that survives
 * what bill PDFs do to it:
 * - reph (র্) in place, moved after the next letter, or dropped: সর্বমোট → সর্বমোট / সবর্মোট / সবমোট
 * - ya-phala (্য) dropped: পরিশোধযোগ্য → পরিশোধযোগ
 * - vowel signs dropped or reordered (all marks are ignored)
 */
const sk = (re: RegExp) =>
  new RegExp(
    re.source
      .replace(/র্([\u0995-\u09B9\u09DC-\u09DF])/g, 'র?$1র?')
      .replace(/্য/g, 'য?')
      .replace(MARKS, ''),
    re.flags,
  )

type Finder<T> = (text: string) => T | null
type Line = { text: string; s: string; map: number[] }

/**
 * Finds the first line matching one of the labels (in priority order) and reads
 * the value after the label on that line, or on the next two lines. Lines that
 * match `skip` (e.g. "after due date") are ignored.
 */
function labeled<T>(lines: Line[], labels: RegExp[], find: Finder<T>, skip?: RegExp): T | null {
  for (const label of labels) {
    for (let i = 0; i < lines.length; i++) {
      const { text, s, map } = lines[i]
      const match = label.exec(s)
      if (!match || skip?.test(s)) continue
      const end = match.index + match[0].length
      const rest = text.slice(end < map.length ? map[end] : text.length)
      const value = find(rest) ?? find(lines[i + 1]?.text ?? '') ?? find(lines[i + 2]?.text ?? '')
      if (value !== null) return value
    }
  }
  return null
}

interface Readings {
  present: number
  previous: number
  units: number
}

/**
 * Meter readings: three numbers near a "reading" label where
 * present − previous = consumed (604 − 417 = 187). Independent of layout.
 */
function readingsFrom(lines: Line[]): Readings | null {
  for (let i = 0; i < lines.length; i++) {
    if (!/reading|রিডিং/i.test(lines[i].text) && !/রড(?![\u0995-\u09B9])/.test(lines[i].s)) continue
    const nums: number[] = []
    for (const l of lines.slice(i, i + 10)) {
      for (const m of l.text.matchAll(/(?<![\d./-])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d/-])/g)) {
        nums.push(Number(m[1].replace(/,/g, '') + (m[2] ?? '')))
      }
    }
    // Bills print present-then-previous or previous-then-present; units come last.
    const match = (x: number, y: number, c: number): Readings | null => {
      if (c <= 0) return null
      if (x > y && Math.abs(x - y - c) < 0.01) return { present: x, previous: y, units: c }
      if (y > x && Math.abs(y - x - c) < 0.01) return { present: y, previous: x, units: c }
      return null
    }
    for (let j = 0; j + 2 < nums.length; j++) {
      const r = match(nums[j], nums[j + 1], nums[j + 2])
      if (r) return r
    }
    for (let j = 0; j < nums.length; j++)
      for (let k = j + 1; k < nums.length; k++)
        for (let m = k + 1; m < nums.length; m++) {
          const r = match(nums[j], nums[k], nums[m])
          if (r) return r
        }
  }
  return null
}

// DPDC's own wording, tolerant of the letters its bill font drops
// (র্ in সর্বমোট, ্য in পরিশোধযোগ্য).
const DPDC_TOTAL = /সর্বমোট\s*পরিশোধযোগ্য\s*টাকা/
const DPDC_LATE_TOTAL = /(?:পরিশোধের\s*)?শেষ\s*তারিখের\s*পর\s*(?:পরিশোধযোগ্য\s*)?(?:সর্বমোট|মোট)\s*টাকা/

// Labels, most specific first. Bangla ones are matched on skeletons (see sk).
const AMOUNT_LABELS = [
  sk(DPDC_TOTAL),
  /payable\s*(?:with)?in\s*(?:the\s*)?due\s*date|(?:on|by)\s*(?:or\s*before\s*)?(?:the\s*)?due\s*date/i,
  sk(/(?:নির্ধারিত|শেষ)?\s*তারিখের\s*মধ্যে|তারিখের\s*ভিতরে/),
  /net\s*payable|total\s*payable|payable\s*amount|amount\s*payable|amount\s*to\s*be\s*paid/i,
  // Payable totals before general ones: "মাসিক মোট বিল" is the unrounded monthly
  // total (1607.55), not what is payable (1608.00).
  sk(/সর্বমোট|পরিশোধযোগ্য\s*(?:টাকা|অর্থ)?|প্রদেয়\s*(?:টাকা|অর্থ)|প্রদেয়\s*(?:টাকা|অর্থ)|মোট\s*(?:প্রদেয়|প্রদেয়|দেয়|দেয়|পরিশোধযোগ্য)/),
  /grand\s*total|total\s*bill(?:\s*amount)?|total\s*amount|bill\s*amount/i,
  sk(/মোট\s*(?:টাকা|বিল)/),
  /(?<![a-z])total(?![a-z])/i,
]
const LATE_AMOUNT_LABELS = [
  sk(DPDC_LATE_TOTAL),
  /payable\s*after\s*(?:the\s*)?due\s*date|after\s*(?:the\s*)?due\s*date|total\s*with\s*(?:lps|surcharge)/i,
  sk(/তারিখের\s*পর(?!শ)|বিলম্ব\s*মাশুলসহ/),
]
/** Late-payment lines: the amount there includes a surcharge. */
const LATE_PAYMENT = new RegExp(
  [
    sk(DPDC_LATE_TOTAL).source,
    /after\s*(?:the\s*)?due|late\s*(?:payment|fee|charge)|surcharge|(?<![a-z])lps(?![a-z])/.source,
    sk(/বিলম্ব|মাশুল|সারচার্জ/).source,
    sk(/তারিখের\s*পর(?!শ)/).source, // "after the date", but not "তারিখের পরিশোধ…"
  ].join('|'),
  'i',
)
// Fallback when no "consumed" number is printed. Tolerates damage seen on real
// bills: "তমান রিডিং" (বর্তমান), "পূ ববতী রিডিং" (পূর্ববর্তী).
const PRESENT_LABELS = [/present\s*(?:meter\s*)?reading|current\s*reading/i, sk(/ব?র্তমান\s*রিডিং/)]
const PREVIOUS_LABELS = [/previous\s*(?:meter\s*)?reading|last\s*reading/i, sk(/পূর্ব(?:বর্তী)?\s*রিডিং/)]
const readingValue: Finder<number> = (t) => {
  const m = /(?<![\d./-])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d/-])/.exec(t)
  return m ? Number(m[1].replace(/,/g, '') + (m[2] ?? '')) : null
}

const UNIT_LABELS = [
  /(?:units?\s*consumed|consumed\s*units?|total\s*(?:units?|consumption)|net\s*units?|billed\s*units?|energy\s*consumed|consumption)/i,
  sk(/ব্যবহৃত\s*(?:ইউনিট|বিদ্যুৎ)|ববত\s*ইউনিট|মোট\s*ইউনিট|বিলকৃত\s*ইউনিট|ইউনিট/),
  /kwh/i,
]
const DUE_LABELS = [
  /due\s*date|last\s*date(?:\s*of\s*payment)?|pay\s*by|payment\s*due/i,
  sk(/পরিশোধের\s*শেষ\s*তারিখ|শেষ\s*তারিখ|পরিশোধের\s*তারিখ/),
]
const MONTH_LABELS = [/bill(?:ing)?\s*(?:month|period)|month\s*of\s*bill/i, sk(/বিলের\s*মাস|বিল\s*মাস|মাস/)]
const CUSTOMER_LABELS = [
  /customer\s*(?:no|number|id)|consumer\s*(?:no|number)|account\s*(?:no|number)/i,
  // "কামার নং" is how some bills return কাস্টমার নং (the স্ট conjunct is lost).
  sk(/(?:কাস্টমার|কাস্টোমার|কামার|গ্রাহক)\s*(?:নং|নম্বর|নাম্বার)|হিসাব\s*নম্বর/),
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
  const lines: Line[] = text
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/\s+/g, ' ')
        .replace(/([ঀ-৿]) (?=[ঀ-৿])/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .map((l) => ({ text: l, ...skeletonOf(l) }))

  const fromFile = opts.fileName ? FILE_NAME.exec(opts.fileName) : null
  const fileMonth = fromFile ? monthFromWord(fromFile[2]) : null
  const fileYear = fromFile ? toYear(fromFile[3]) : null

  // Customer number: a saved number seen in the text beats a label match, which beats the file name.
  const known = (opts.knownCustomerNos ?? []).find((no) => new RegExp(`(?<!\\d)${no}(?!\\d)`).test(text))
  const customerNo = known ?? labeled(lines, CUSTOMER_LABELS, digitsOnly) ?? fromFile?.[1] ?? null

  // Month: the file name is authoritative; then a labelled "Bill Month"; then the first month/year in the text.
  const period =
    fileMonth && fileYear
      ? { year: fileYear, month: fileMonth }
      : (labeled(lines, MONTH_LABELS, findPeriod) ?? findPeriod(lines.slice(0, 40).map((l) => l.text).join('\n')))

  const readings = readingsFrom(lines)
  const present = readings ? null : labeled(lines, PRESENT_LABELS, readingValue)
  const previous = readings ? null : labeled(lines, PREVIOUS_LABELS, readingValue)
  const units =
    readings?.units ??
    labeled(lines, UNIT_LABELS, findUnits) ??
    (present !== null && previous !== null && present >= previous ? present - previous : null)

  const warning = lines.length === 0 ? 'noText' : looksLikeLegacyBangla(text) ? 'unreadableBangla' : null

  return {
    customerNo,
    year: period?.year ?? null,
    month: period?.month ?? null,
    amount: labeled(lines, AMOUNT_LABELS, findAmount, LATE_PAYMENT),
    lateAmount: labeled(lines, LATE_AMOUNT_LABELS, (t) => amountsIn(t)[0] ?? null),
    units,
    presentReading: readings?.present ?? present,
    previousReading: readings?.previous ?? previous,
    dueDate: labeled(lines, DUE_LABELS, findDate, LATE_PAYMENT),
    warning,
  }
}
