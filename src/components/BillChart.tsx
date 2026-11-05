import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { shiftPeriod } from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import type { BillSummary } from '../lib/userData'

const HEIGHT = 124
const PAD = { top: 18, right: 4, bottom: 20, left: 40 }
const MONTHS = 12

interface Slot {
  year: number
  month: number
  bill?: BillSummary
}

/** One series (bill amount per month), so no legend; the month list below is the table view. */
export function BillChart({ bills }: { bills: BillSummary[] }) {
  const { t, shortMonth, formatMoney, formatQuantity, formatPeriod, formatNumber } = useI18n()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(560)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A continuous run of months ending at the latest bill, so gaps show as gaps.
  const slots = useMemo<Slot[]>(() => {
    const latest = bills[0]
    if (!latest) return []
    const byKey = new Map(bills.map((b) => [`${b.year}-${b.month}`, b]))
    return Array.from({ length: MONTHS }, (_, i) => {
      const p = shiftPeriod({ year: latest.year, month: latest.month }, i - (MONTHS - 1))
      return { ...p, bill: byKey.get(`${p.year}-${p.month}`) }
    }).filter((s, i, all) => s.bill || all.slice(0, i).some((x) => x.bill)) // drop empty months before the first bill
  }, [bills])

  const amounts = slots.map((s) => s.bill?.amount ?? 0)
  const max = Math.max(...amounts, 1)
  const step = niceStep(max / 2)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const band = plotW / Math.max(slots.length, 1)
  const barW = Math.min(36, Math.max(6, band - 2 - band * 0.28)) // ≥2px surface gap between bars
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH

  const latestIdx = slots.findLastIndex((s) => s.bill?.amount != null)
  const maxIdx = amounts.indexOf(Math.max(...amounts))
  const labelled = new Set([latestIdx, maxIdx].filter((i) => i >= 0 && amounts[i] > 0))

  if (slots.length === 0) return null
  const hovered = hover !== null ? slots[hover] : null

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${t('billChartLabel')}: ${slots
          .filter((s) => s.bill?.amount != null)
          .map((s) => `${formatPeriod(s.year, s.month)} ${formatMoney(s.bill!.amount!)}`)
          .join(', ')}`}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'chart__base' : 'chart__grid'} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart__tick" x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {compact(v, formatNumber)}
            </text>
          </g>
        ))}
        {slots.map((s, i) => {
          const cx = PAD.left + band * i + band / 2
          const amount = s.bill?.amount
          const h = amount ? Math.max(2, plotH - (y(amount) - PAD.top)) : 0
          const showYear = i === 0 || s.month === 1
          return (
            <g key={`${s.year}-${s.month}`}>
              {/* hit target: the whole column, bigger than the bar */}
              <rect
                className="chart__hit"
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
              />
              {amount ? (
                <path
                  className={`chart__bar ${hover !== null && hover !== i ? 'is-dim' : ''}`}
                  d={roundedTop(cx - barW / 2, y(amount), barW, h, Math.min(4, barW / 2))}
                />
              ) : null}
              {amount && labelled.has(i) ? (
                <text className="chart__value" x={cx} y={y(amount) - 6} textAnchor="middle">
                  {formatMoney(Math.round(amount))}
                </text>
              ) : null}
              <text className="chart__tick" x={cx} y={HEIGHT - PAD.bottom + 14} textAnchor="middle">
                {band < 30 ? shortMonth(s.month).slice(0, 1) : shortMonth(s.month)}
                {showYear && band >= 30 ? ` ${formatNumber(s.year).slice(-2)}` : ''}
              </text>
            </g>
          )
        })}
      </svg>
      {hovered && hover !== null && (
        <div
          className="chart__tip"
          style={{
            left: Math.min(Math.max(PAD.left + band * hover + band / 2, 70), width - 70),
            top: hovered.bill?.amount ? Math.max(0, y(hovered.bill.amount) - 8) : PAD.top,
          }}
        >
          <strong>{formatPeriod(hovered.year, hovered.month)}</strong>
          {hovered.bill ? (
            <>
              <span>{hovered.bill.amount != null ? formatMoney(hovered.bill.amount) : '—'}</span>
              {hovered.bill.units != null && <span>{formatQuantity(hovered.bill.units)} kWh</span>}
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      )}
    </div>
  )
}

/** A bar with 4px rounded top corners and a square base sitting on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
}

function compact(v: number, fmt: (n: number) => string): string {
  if (v >= 1000) return `${fmt(Math.round((v / 1000) * 10) / 10)}k`
  return fmt(v)
}
