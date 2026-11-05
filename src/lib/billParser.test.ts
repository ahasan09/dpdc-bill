import { describe, expect, it } from 'vitest'
import { findDate, findPeriod, parseBillText, repairBangla } from './billParser'

// All bills below are invented test data.

const ENGLISH_BILL = `
Dhaka Power Distribution Company Limited
ELECTRICITY BILL
Customer No: 12345678        Meter No: 00000000
Name: Test Customer
Bill Month: September 2026   Issue Date: 01-10-2026
Previous Reading 10,200   Present Reading 10,512
Units Consumed: 312 kWh
Energy Charge Tk. 2,401.50
Demand Charge Tk. 84.00
VAT (5%) Tk. 124.28
Total Amount Tk. 2,609.78
Net Payable Amount Tk. 2,610.00
Due Date: 15-10-2026
Consumption history: Aug-2026 290  Jul-2026 340
`

const BANGLA_BILL = `
ঢাকা পাওয়ার ডিস্ট্রিবিউশন কোম্পানি লিমিটেড
বিদ্যুৎ বিল
কাস্টমার নম্বর: ১২৩৪৫৬৭৮
বিলের মাস: সেপ্টেম্বর ২০২৬
ব্যবহৃত ইউনিট: ৩১২
বিদ্যুৎ চার্জ ২,৪০১.৫০
মোট দেয় টাকা
২,৬১০.০০
পরিশোধের শেষ তারিখ: ১৫/১০/২০২৬
`

describe('parseBillText', () => {
  it('reads an English bill by its labels', () => {
    expect(parseBillText(ENGLISH_BILL)).toEqual({
      customerNo: '12345678',
      year: 2026,
      month: 9,
      amount: 2610,
      lateAmount: null,
      units: 312,
      presentReading: 10512,
      previousReading: 10200,
      dueDate: '2026-10-15',
      warning: null,
    })
  })

  it('reads a Bangla bill, including Bangla digits and a value on the next line', () => {
    expect(parseBillText(BANGLA_BILL)).toEqual({
      customerNo: '12345678',
      year: 2026,
      month: 9,
      amount: 2610,
      lateAmount: null,
      units: 312,
      presentReading: null,
      previousReading: null,
      dueDate: '2026-10-15',
      warning: null,
    })
  })

  it('takes customer number and month from the DPDC file name', () => {
    const parsed = parseBillText('Net Payable: 1,050.00', { fileName: 'ebill_87654321_August_2026.pdf' })
    expect(parsed).toMatchObject({ customerNo: '87654321', year: 2026, month: 8, amount: 1050 })
  })

  it('prefers a saved customer number found in the text', () => {
    const parsed = parseBillText('Ref 99999999\nAccount 11223344\nTotal 500', { knownCustomerNos: ['11223344'] })
    expect(parsed.customerNo).toBe('11223344')
  })

  it('prefers the payable total over other charges', () => {
    const parsed = parseBillText('Energy Charge 900.00\nTotal 950.00\nNet Payable 960.00')
    expect(parsed.amount).toBe(960)
  })

  it('reports PDFs without text', () => {
    expect(parseBillText('').warning).toBe('noText')
  })

  it('reports legacy-font Bangla that cannot be read', () => {
    const gibberish = '‡gvU †`q UvKv ‡gvU †`q UvKv we`y¨r wej cwi‡kv‡ai †kl ZvwiL ‡gvU †`q UvKv we`y¨r wej'
    expect(parseBillText(gibberish).warning).toBe('unreadableBangla')
  })

  it('leaves fields empty when nothing matches', () => {
    expect(parseBillText('Hello world')).toMatchObject({ customerNo: null, amount: null, units: null, dueDate: null })
  })
})

describe('findPeriod and findDate', () => {
  it.each([
    ['September 2026', { year: 2026, month: 9 }],
    ['Sep-2026', { year: 2026, month: 9 }],
    ["Sep'26", { year: 2026, month: 9 }],
    ['অক্টোবর ২০২৬', { year: 2026, month: 10 }],
    ['আগস্ট, ২০২৫', { year: 2025, month: 8 }],
    ['09/2026', { year: 2026, month: 9 }],
  ])('period %s', (text, expected) => {
    expect(findPeriod(text)).toEqual(expected)
  })

  it.each([
    ['15-10-2026', '2026-10-15'],
    ['5/1/2026', '2026-01-05'],
    ['15 Oct 2026', '2026-10-15'],
    ['15th October, 2026', '2026-10-15'],
    ['১৫ অক্টোবর ২০২৬', '2026-10-15'],
    ['2026-10-15', '2026-10-15'],
  ])('date %s', (text, expected) => {
    expect(findDate(text)).toBe(expected)
  })
})

describe('repairBangla', () => {
  it('moves pre-base vowel signs after their consonant (cluster)', () => {
    expect(repairBangla('িডস্ট্রিিবউশন িবল')).toBe('ডিস্ট্রিবিউশন বিল')
  })
  it('recombines split o-kar and strips empty characters', () => {
    expect(repairBangla('েমাট েদয়')).toBe('মোট দেয়')
    expect(repairBangla('ব\u0000বহার')).toBe('ববহার') // mid-word: unmappable conjunct, dropped
  })
  it('leaves correctly ordered Bangla alone', () => {
    expect(repairBangla('ডিস্ট্রিবিউশন কোম্পানি পরিশোধের শেষ তারিখ')).toBe('ডিস্ট্রিবিউশন কোম্পানি পরিশোধের শেষ তারিখ')
  })
  it('lets a visually ordered bill be parsed', () => {
    const visual = 'েমাট েদয় টাকা ১,৯৮০.০০\nপিরেশােধর েশষ তািরখ: ১৫/০৯/২০২৬'
    expect(parseBillText(visual)).toMatchObject({ amount: 1980, dueDate: '2026-09-15' })
  })
})

describe('Bangla text as Chrome-made PDFs return it', () => {
  // Shape copied from pdf.js output for an invented test bill.
  const raw = [
    'কাস্ট মার নম্ব র: ৮৭৬৫৪৩২১',
    'িবেলর মাস: আগস্ট ২০২৬',
    'ব\u0000বহৃ ত ইউিনট: ২৪০',
    '\u0000মাট \u0000দয় টাকা ১,৯৮০.০০',
    'পিরেশােধর \u0000শষ তািরখ: ১৫/০৯/২০২৬',
  ].join('\n')

  it('treats \\u0000 at a word start as e-kar', () => {
    expect(repairBangla('\u0000মাট \u0000দয় \u0000শষ')).toBe('মোট দেয় শেষ')
  })

  it('reads every field', () => {
    expect(parseBillText(raw)).toEqual({
      customerNo: '87654321',
      year: 2026,
      month: 8,
      amount: 1980,
      lateAmount: null,
      units: 240,
      presentReading: null,
      previousReading: null,
      dueDate: '2026-09-15',
      warning: null,
    })
  })
})

describe('real-bill shapes reported by a user (labels and readings only)', () => {
  // Pasted from a real DPDC bill: label text as the PDF returns it, plus meter readings.
  const readings = ['তমান িরিডং', 'পূ', 'ববতী িরিডং', 'ববত ইউিনট', '604', '417', '187'].join('\n')

  it('takes units from present − previous readings, not the first number', () => {
    expect(parseBillText(readings).units).toBe(187)
  })

  it('also works when the readings sit in one table row', () => {
    expect(parseBillText('বর্তমান রিডিং পূর্ববর্তী রিডিং ব্যবহৃত ইউনিট\n604 417 187').units).toBe(187)
  })

  it('reads the due date under a damaged label', () => {
    expect(parseBillText('পিরেশােধর শষ তািরখ\n15-10-2026').dueDate).toBe('2026-10-15')
  })

  it('reads the customer number under "কামার নং"', () => {
    expect(parseBillText('কামার নং 12345678').customerNo).toBe('12345678')
  })
})

describe('amount payable by the due date, not after it', () => {
  it.each([
    ['separate lines, on-time first', 'নির্ধারিত তারিখের মধ্যে পরিশোধযোগ্য 2,610.00\nনির্ধারিত তারিখের পরে পরিশোধযোগ্য 2,740.50'],
    ['late line first', 'বিলম্ব মাশুলসহ মোট টাকা 2,740.50\nমোট টাকা 2,610.00'],
    ['two totals side by side', 'মোট টাকা\n2,740.50 2,610.00'],
    ['English, late first', 'Payable after due date Tk. 2,740.50\nNet Payable Tk. 2,610.00'],
    ['English with LPS', 'Total with LPS 2,740.50\nTotal Amount 2,610.00'],
    ['damaged Bangla', 'িনধািরত তািরেখর মেধ্য 2,610.00\nিনধািরত তািরেখর পের 2,740.50'],
  ])('%s', (_, text) => {
    expect(parseBillText(text).amount).toBe(2610)
  })

  it('does not merge unrelated amounts on one line', () => {
    expect(parseBillText('Total Amount 2,610.00 VAT 124.28').amount).toBe(2610)
  })
})

describe("DPDC's own amount labels", () => {
  const bill = [
    'পরিশোধের শেষ তারিখ: 15-10-2026',
    'সর্বমোট পরিশোধযোগ্য টাকা 2,610.00',
    'পরিশোধের শেষ তারিখের পর পরিশোধযোগ্য সর্বমোট টাকা 2,740.50',
  ]

  it('reads the on-time and after-due-date totals and the due date', () => {
    expect(parseBillText(bill.join('\n'))).toMatchObject({ amount: 2610, lateAmount: 2740.5, dueDate: '2026-10-15' })
  })

  it('works whatever order the lines come in', () => {
    expect(parseBillText([bill[2], bill[1], bill[0]].join('\n'))).toMatchObject({
      amount: 2610,
      lateAmount: 2740.5,
      dueDate: '2026-10-15',
    })
  })

  it('never takes the due date from the after-due-date line', () => {
    const text = 'পরিশোধের শেষ তারিখের পর পরিশোধযোগ্য সর্বমোট টাকা\n2,740.50\n01-11-2026\nপরিশোধের শেষ তারিখ\n15-10-2026'
    expect(parseBillText(text).dueDate).toBe('2026-10-15')
  })

  it('copes with the letters the bill font drops (র্ and ্য)', () => {
    const damaged = 'সবেমাট পিরেশাধেযাগ টাকা 2,610.00\nপিরেশােধর শষ তািরেখর পর পিরেশাধেযাগ সবেমাট টাকা 2,740.50'
    expect(parseBillText(damaged)).toMatchObject({ amount: 2610, lateAmount: 2740.5 })
  })
})

describe('meter readings', () => {
  it('keeps present and previous readings from the real-bill readings block', () => {
    const readings = ['তমান িরিডং', 'পূ', 'ববতী িরিডং', 'ববত ইউিনট', '604', '417', '187'].join('\n')
    expect(parseBillText(readings)).toMatchObject({ presentReading: 604, previousReading: 417, units: 187 })
  })

  it('works out units from the two readings when no consumed figure is printed', () => {
    expect(parseBillText('বর্তমান রিডিং: 604\nপূর্ববর্তী রিডিং: 417')).toMatchObject({
      presentReading: 604,
      previousReading: 417,
      units: 187,
    })
  })

  it('reads damaged reading labels', () => {
    expect(parseBillText('তমান রিডিং 604\nপূ ববতী রিডিং 417')).toMatchObject({ presentReading: 604, previousReading: 417 })
  })

  it('reads English reading labels', () => {
    expect(parseBillText('Present Reading 10,512\nPrevious Reading 10,200')).toMatchObject({
      presentReading: 10512,
      previousReading: 10200,
      units: 312,
    })
  })
})

describe('August bill layout: two-column totals table', () => {
  // Pasted from a real bill (amounts only).
  const table = [
    'মাসিক মোট বিল',
    '1607.55    সর্বমোট পরিশোধযোগ্য টাকা    1608.00',
    'পরিশোধের শেষ তারিখের পর মোট টাকা',
    '1685.00    পরিশোধের শেষ তারিখের পর পরিশোধযোগ্য সর্বমোট টাকা    1685.00',
  ]

  it('takes the payable total, not the unrounded monthly total', () => {
    expect(parseBillText(table.join('\n'))).toMatchObject({ amount: 1608, lateAmount: 1685 })
  })

  it.each([
    ['reph moved after the next letter', 'সবর্মোট'],
    ['reph dropped', 'সবমোট'],
    ['visual order with reph moved', 'সবর্েমাট'],
  ])('still finds the payable total with %s', (_, word) => {
    const text = table.join('\n').replaceAll('সর্বমোট', word).replaceAll('পরিশোধযোগ্য', 'পিরেশাধেযাগ')
    expect(parseBillText(text)).toMatchObject({ amount: 1608, lateAmount: 1685 })
  })

  it('never falls back to the monthly total when the payable label is unreadable', () => {
    const text = 'মাসিক মোট বিল\n1607.55    ????? পরিশোধযোগ্য টাকা    1608.00'
    expect(parseBillText(text).amount).toBe(1608)
  })
})

describe('reph tolerance in reading labels', () => {
  it.each([
    ['বর্তমান রিডিং 604\nপূর্ববর্তী রিডিং 417'],
    ['বতর্মান রিডিং 604\nপূবর্বতর্ী রিডিং 417'],
    ['তমান রিডিং 604\nপূববতী রিডিং 417'],
  ])('%s', (text) => {
    expect(parseBillText(text)).toMatchObject({ presentReading: 604, previousReading: 417, units: 187 })
  })
})
