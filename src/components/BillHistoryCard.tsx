import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { accountLabel } from '../lib/labels'
import {
  addAccount,
  billsFor,
  defaultAccount,
  findAccountByNo,
  removeBill,
  upsertBill,
  type BillSummary,
  type UserData,
} from '../lib/userData'
import { BillChart } from './BillChart'
import { BillImportDialog, type NewBill } from './BillImportDialog'
import { Icon } from './Icon'
import { useToast } from './Toast'

type Update = (fn: (d: UserData) => UserData) => void

export function BillHistoryCard({ data, update }: { data: UserData; update: Update }) {
  const { t, formatMoney, formatQuantity, formatPeriod, formatDate, shortMonth, formatNumber } = useI18n()
  const shortPeriod = (b: { year: number; month: number }) => `${shortMonth(b.month)} ${formatNumber(b.year)}`
  const readingText = (b: BillSummary) =>
    b.previousReading != null || b.presentReading != null
      ? `${b.previousReading != null ? formatQuantity(b.previousReading) : '—'} → ${b.presentReading != null ? formatQuantity(b.presentReading) : '—'}`
      : '—'
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [request, setRequest] = useState<File[] | 'manual' | { edit: BillSummary } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  // Numbers that have bills: saved numbers in their saved order first, then any others.
  const numbers = useMemo(() => {
    const withBills = new Set(data.bills.map((b) => b.customerNo))
    const saved = data.accounts.map((a) => a.customerNo).filter((no) => withBills.has(no))
    return [...saved, ...[...withBills].filter((no) => !saved.includes(no))]
  }, [data.bills, data.accounts])

  const preferred = defaultAccount(data)?.customerNo
  const selected =
    picked && numbers.includes(picked) ? picked : preferred && numbers.includes(preferred) ? preferred : numbers[0]
  const bills = selected ? billsFor(data, selected) : []
  const recent = bills.slice(0, 12).filter((b) => b.amount !== null)
  const latest = bills[0]
  const average = recent.length ? recent.reduce((sum, b) => sum + (b.amount ?? 0), 0) / recent.length : null
  const highest = recent.reduce<BillSummary | null>((m, b) => (!m || (b.amount ?? 0) > (m.amount ?? 0) ? b : m), null)

  const nameFor = (no: string) => {
    const account = findAccountByNo(data, no)
    return account ? accountLabel(account, t) : no
  }

  function openFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (files.length) setRequest(files)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    openFiles(e.dataTransfer.files)
  }

  function save(newBills: NewBill[], replaceId?: string) {
    update((d) => {
      let next = replaceId ? removeBill(d, replaceId) : d
      for (const bill of newBills) {
        if (!findAccountByNo(next, bill.customerNo)) next = addAccount(next, { customerNo: bill.customerNo, nickname: '' })
        next = upsertBill(next, bill)
      }
      return next
    })
    if (newBills[0]) setPicked(newBills[0].customerNo)
    setRequest(null)
    toast(t('billsSaved', { count: newBills.length }))
  }

  function remove(bill: BillSummary) {
    update((d) => removeBill(d, bill.id))
    toast(t('billDeleted', { month: formatPeriod(bill.year, bill.month) }), {
      action: {
        label: t('undo'),
        onClick: () => update((d) => upsertBill(d, bill, bill.addedAt)),
      },
    })
  }

  return (
    <section
      className={`card bills ${dragging ? 'is-dragging' : ''}`}
      aria-labelledby="bills-title"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <div className="card__head">
        <h2 id="bills-title" className="card__title">
          {t('billsTitle')}
        </h2>
        <div className="card__tools">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            title={t('addManually')}
            aria-label={t('addManually')}
            onClick={() => setRequest('manual')}
          >
            <Icon name="plus" size={15} /> <span className="hide-sm">{t('addManually')}</span>
          </button>
          <button type="button" className="btn btn--soft btn--sm" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} /> {t('uploadBills')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              openFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {numbers.length === 0 ? (
        <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={22} />
          <span className="dropzone__title">{t('uploadBills')}</span>
          <span className="dropzone__body">{t('billsEmpty')}</span>
          <span className="dropzone__note">
            <Icon name="shield" size={14} /> {t('billsPrivacy')}
          </span>
        </button>
      ) : (
        <>
          {numbers.length > 1 && (
            <div className="chips chips--tight" role="tablist" aria-label={t('savedAccounts')}>
              {numbers.map((no) => (
                <button
                  key={no}
                  type="button"
                  role="tab"
                  aria-selected={no === selected}
                  className={`chip ${no === selected ? 'is-on' : ''}`}
                  onClick={() => setPicked(no)}
                >
                  {nameFor(no)}
                </button>
              ))}
            </div>
          )}

          <dl className="stats">
            <div className="stat">
              <dt className="stat__label">{t('latestBill')}</dt>
              <dd className="stat__value">
                {latest?.amount != null ? formatMoney(latest.amount) : '—'}
                {latest && <span className="stat__meta">{shortPeriod(latest)}</span>}
              </dd>
            </div>
            <div className="stat">
              <dt className="stat__label">{t('average', { n: recent.length })}</dt>
              <dd className="stat__value">{average !== null ? formatMoney(Math.round(average)) : '—'}</dd>
            </div>
            <div className="stat">
              <dt className="stat__label">{t('highest')}</dt>
              <dd className="stat__value">
                {highest?.amount != null ? formatMoney(highest.amount) : '—'}
                {highest && <span className="stat__meta">{shortPeriod(highest)}</span>}
              </dd>
            </div>
          </dl>

          {recent.length > 1 && <BillChart bills={bills} />}

          <table className="bill-table">
            <thead>
              <tr>
                <th scope="col">{t('billMonth')}</th>
                <th scope="col" className="num">
                  {t('amount')}
                </th>
                <th scope="col" className="num hide-sm">
                  {t('lateAmountShort')}
                </th>
                <th scope="col" className="num">
                  {t('units')}
                </th>
                <th scope="col" className="num hide-sm">
                  {t('meterReading')}
                </th>
                <th scope="col" className="hide-sm">
                  {t('dueDate')}
                </th>
                <th scope="col">
                  <span className="sr-only">{t('edit')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <th scope="row">{formatPeriod(b.year, b.month)}</th>
                  <td className="num">{b.amount != null ? formatMoney(b.amount) : '—'}</td>
                  <td className="num hide-sm muted">{b.lateAmount != null ? formatMoney(b.lateAmount) : '—'}</td>
                  <td className="num">{b.units != null ? formatQuantity(b.units) : '—'}</td>
                  <td className="num hide-sm muted">{readingText(b)}</td>
                  <td className="hide-sm">{b.dueDate ? formatDate(b.dueDate) : t('noDueDate')}</td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('editBill')}
                      aria-label={`${t('editBill')}: ${formatPeriod(b.year, b.month)}`}
                      onClick={() => setRequest({ edit: b })}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title={t('deleteBill')}
                      aria-label={`${t('deleteBill')}: ${formatPeriod(b.year, b.month)}`}
                      onClick={() => remove(b)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <Icon name="upload" size={24} /> {t('dropHere')}
        </div>
      )}

      <BillImportDialog
        request={request}
        data={data}
        defaultCustomerNo={selected}
        onClose={() => setRequest(null)}
        onSave={save}
      />
    </section>
  )
}
