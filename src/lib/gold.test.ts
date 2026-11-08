import { describe, expect, it } from 'vitest'
import { parseBajusPerGram, perVori, sanitizeGoldPrice } from './gold'

// Trimmed from the real bajus.org/gold-price table.
const row = (karat: string, price: string) => `
  <tr>
    <th scope="row"><h6>
        ${karat} Gold
    </h6></th>
    <td class="align-middle"><p>CADMIUM (HALLMARKED GOLD)</p></td>
    <td class="align-middle text-center"><span class="price">${price} BDT/GRAM</span></td>
  </tr>`
const page = `<table>${row('22 KARAT', '19,455')}${row('21 KARAT', '18,580')}${row('18 KARAT', '15,955')}</table>`

describe('parseBajusPerGram', () => {
  it('reads the price for the asked karat', () => {
    expect(parseBajusPerGram(page, 21)).toBe(18580)
    expect(parseBajusPerGram(page, 22)).toBe(19455)
  })

  it('returns null when the price is missing or implausible', () => {
    expect(parseBajusPerGram('<p>Maintenance</p>', 21)).toBeNull()
    expect(parseBajusPerGram(row('21 KARAT', '12'), 21)).toBeNull()
  })
})

describe('gold price file', () => {
  it('converts grams to vori (11.664 g)', () => {
    expect(perVori(18580)).toBe(216717)
  })

  it('accepts a valid file and rejects a broken one', () => {
    const ok = sanitizeGoldPrice({ karat: 21, perGram: 18580, since: '2026-11-08T16:43:43.967Z', source: 'https://www.bajus.org/gold-price' })
    expect(ok?.perVori).toBe(216717)
    expect(sanitizeGoldPrice({ karat: 21, perGram: 'x', since: 'now' })).toBeNull()
    expect(sanitizeGoldPrice({ karat: 21, perGram: 18580, since: '2026-11-08', source: 'javascript:alert(1)' })?.source).toBe(
      'https://www.bajus.org/gold-price',
    )
  })
})
