import { useEffect, useId, useState } from 'react'
import { parseBillText } from '../lib/billParser'
import { availableYears, normalizeCustomerNo, shiftPeriod, currentPeriod, validateCustomerNo } from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import { accountLabel } from '../lib/labels'
import { PdfReadError, extractPdfText } from '../lib/pdfText'
import { findAccountByNo, findBill, type BillSummary, type UserData } from '../lib/userData'
import { Dialog } from './Dialog'

export type NewBill = Omit<BillSummary, 'id' | 'addedAt'>

interface Form {
  customerNo: string
  year: number
  month: number
  amount: string
  lateAmount: string
  units: string
  dueDate: string
}

interface Item {
  key: string
  fileName: string
  status: 'reading' | 'ready' | 'error'
  error?: MessageKey
  warning?: MessageKey
  /** Fields the PDF did not provide, so the user knows what to fill in. */
  missing: Set<keyof Form>
  form: Form
  skipped: boolean
}

const readErrors: Record<PdfReadError['reason'], MessageKey> = {
  tooBig: 'errTooBig',
  notPdf: 'errNotPdf',
  protected: 'errProtected',
  broken: 'errBroken',
}

function blankForm(data: UserData, customerNo?: string): Form {
  const last = shiftPeriod(currentPeriod(), -1)
  const no = customerNo ?? data.accounts.find((a) => a.id === data.defaultAccountId)?.customerNo ?? ''
  return { customerNo: no, year: last.year, month: last.month, amount: '', lateAmount: '', units: '', dueDate: '' }
}

export function BillImportDialog({
  request,
  data,
  defaultCustomerNo,
  onClose,
  onSave,
}: {
  /** Files to read, 'manual' for one empty form, or a saved bill to edit. */
  request: File[] | 'manual' | { edit: BillSummary } | null
  data: UserData
  defaultCustomerNo?: string
  onClose: () => void
  /** replaceId: the bill being edited, removed first in case its number or month changed. */
  onSave: (bills: NewBill[], replaceId?: string) => void
}) {
  const { t, monthName, formatNumber, formatPeriod } = useI18n()
  const [items, setItems] = useState<Item[]>([])
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setTouched(false)
    if (request === null) {
      setItems([]) // never show the previous batch when the dialog opens again
      return
    }
    if (typeof request === 'object' && 'edit' in request) {
      const b = request.edit
      setItems([
        {
          key: b.id,
          fileName: '',
          status: 'ready',
          missing: new Set(),
          skipped: false,
          form: {
            customerNo: b.customerNo,
            year: b.year,
            month: b.month,
            amount: b.amount !== null ? String(b.amount) : '',
            lateAmount: b.lateAmount !== null ? String(b.lateAmount) : '',
            units: b.units !== null ? String(b.units) : '',
            dueDate: b.dueDate ?? '',
          },
        },
      ])
      return
    }
    if (request === 'manual') {
      setItems([
        { key: 'manual', fileName: '', status: 'ready', missing: new Set(), form: blankForm(data, defaultCustomerNo), skipped: false },
      ])
      return
    }
    const initial: Item[] = request.map((file, i) => ({
      key: `${i}-${file.name}`,
      fileName: file.name,
      status: 'reading',
      missing: new Set(),
      form: blankForm(data, defaultCustomerNo),
      skipped: false,
    }))
    setItems(initial)
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < request.length; i++) {
        const file = request[i]
        let update: Partial<Item>
        try {
          const text = await extractPdfText(file)
          const parsed = parseBillText(text, {
            fileName: file.name,
            knownCustomerNos: data.accounts.map((a) => a.customerNo),
          })
          const fallback = blankForm(data, defaultCustomerNo)
          const missing = new Set<keyof Form>()
          if (!parsed.customerNo) missing.add('customerNo')
          if (!parsed.month || !parsed.year) missing.add('month')
          if (parsed.amount === null) missing.add('amount')
          if (parsed.units === null) missing.add('units')
          if (!parsed.dueDate) missing.add('dueDate')
          update = {
            status: 'ready',
            missing,
            warning: parsed.warning === 'noText' ? 'warnNoText' : parsed.warning === 'unreadableBangla' ? 'warnBangla' : undefined,
            form: {
              customerNo: parsed.customerNo ?? fallback.customerNo,
              year: parsed.year ?? fallback.year,
              month: parsed.month ?? fallback.month,
              amount: parsed.amount !== null ? String(parsed.amount) : '',
              lateAmount: parsed.lateAmount !== null ? String(parsed.lateAmount) : '',
              units: parsed.units !== null ? String(parsed.units) : '',
              dueDate: parsed.dueDate ?? '',
            },
          }
        } catch (error) {
          update = { status: 'error', error: error instanceof PdfReadError ? readErrors[error.reason] : 'errBroken', skipped: true }
        }
        if (cancelled) return
        setItems((all) => all.map((it, j) => (j === i ? { ...it, ...update } : it)))
      }
    })()
    return () => {
      cancelled = true
    }
    // Only re-run when a new set of files arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const editing = request && typeof request === 'object' && 'edit' in request ? request.edit : undefined
  const active = items.filter((it) => it.status === 'ready' && !it.skipped)
  const errorsFor = (f: Form) => ({
    customerNo: validateCustomerNo(f.customerNo) !== null,
    amount: !(Number(f.amount) > 0),
  })
  const reading = items.some((it) => it.status === 'reading')
  const canSave = !reading && active.length > 0

  function save() {
    setTouched(true)
    if (active.some((it) => Object.values(errorsFor(it.form)).some(Boolean))) return
    onSave(
      active.map((it) => ({
        customerNo: normalizeCustomerNo(it.form.customerNo),
        year: it.form.year,
        month: it.form.month,
        amount: Number(it.form.amount),
        lateAmount: Number(it.form.lateAmount) > 0 ? Number(it.form.lateAmount) : null,
        units: it.form.units.trim() !== '' && Number.isFinite(Number(it.form.units)) ? Number(it.form.units) : null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(it.form.dueDate) ? it.form.dueDate : null,
        fileName: it.fileName || editing?.fileName || '',
      })),
      editing?.id,
    )
  }

  const setForm = (key: string, patch: Partial<Form>) =>
    setItems((all) => all.map((it) => (it.key === key ? { ...it, form: { ...it.form, ...patch } } : it)))

  return (
    <Dialog
      open={request !== null}
      onClose={onClose}
      title={editing ? t('editBill') : request === 'manual' ? t('manualTitle') : t('importTitle')}
      subtitle={editing || request === 'manual' ? undefined : t('importSubtitle')}
      wide
    >
      <div className="stack">
        <datalist id="saved-numbers">
          {data.accounts.map((a) => (
            <option key={a.id} value={a.customerNo}>
              {accountLabel(a, t)}
            </option>
          ))}
        </datalist>

        <div className="import-list">
          {items.map((it) => (
            <ImportRow
              key={it.key}
              item={it}
              data={data}
              touched={touched}
              errors={errorsFor(it.form)}
              onChange={(patch) => setForm(it.key, patch)}
              onSkip={(skipped) => setItems((all) => all.map((x) => (x.key === it.key ? { ...x, skipped } : x)))}
              labels={{ monthName, formatNumber, formatPeriod }}
            />
          ))}
        </div>

        <p className="hint">{t('billsPrivacy')}</p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSave} onClick={save}>
            {reading && <span className="spinner" aria-hidden="true" />}
            {editing ? t('save') : t('saveBills', { count: active.length })}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function ImportRow({
  item,
  data,
  touched,
  errors,
  onChange,
  onSkip,
  labels,
}: {
  item: Item
  data: UserData
  touched: boolean
  errors: { customerNo: boolean; amount: boolean }
  onChange: (patch: Partial<Form>) => void
  onSkip: (skipped: boolean) => void
  labels: { monthName: (m: number) => string; formatNumber: (n: number) => string; formatPeriod: (y: number, m: number) => string }
}) {
  const { t } = useI18n()
  const id = useId()
  const f = item.form
  const miss = (k: keyof Form) => item.missing.has(k)

  if (item.status === 'reading') {
    return (
      <div className="import-item import-item--busy" aria-busy="true">
        <span className="spinner" aria-hidden="true" /> {t('reading', { name: item.fileName })}
      </div>
    )
  }
  if (item.status === 'error') {
    return (
      <div className="import-item import-item--error" role="alert">
        <p className="import-item__file">{item.fileName}</p>
        <p className="error">{item.error && t(item.error)}</p>
      </div>
    )
  }

  const validNo = validateCustomerNo(f.customerNo) === null
  const found = validNo ? findBill(data, f.customerNo, f.year, f.month) : undefined
  const existing = found && found.id !== item.key ? found : undefined
  const unsaved = validNo && !findAccountByNo(data, f.customerNo)
  const showErr = (k: 'customerNo' | 'amount') => touched && errors[k]

  return (
    <div className={`import-item ${item.skipped ? 'is-skipped' : ''}`}>
      {item.fileName && (
        <div className="import-item__head">
          <p className="import-item__file" title={item.fileName}>
            {item.fileName}
          </p>
          <label className="checkbox checkbox--sm">
            <input type="checkbox" checked={item.skipped} onChange={(e) => onSkip(e.target.checked)} />
            <span>{t('skipFile')}</span>
          </label>
        </div>
      )}
      {item.warning && <p className="alert alert--warn">{t(item.warning)}</p>}

      <fieldset className="import-grid" disabled={item.skipped}>
        <legend className="sr-only">{item.fileName || t('manualTitle')}</legend>
        <div className="field">
          <label className="label label--sub" htmlFor={`${id}-no`}>
            {t('customerNo')}
          </label>
          <input
            id={`${id}-no`}
            className={`input mono ${showErr('customerNo') ? 'is-invalid' : ''}`}
            inputMode="numeric"
            list="saved-numbers"
            autoComplete="off"
            value={f.customerNo}
            onChange={(e) => onChange({ customerNo: e.target.value })}
          />
          {showErr('customerNo') ? (
            <p className="error">{t('errLength', { min: 6, max: 12 })}</p>
          ) : miss('customerNo') ? (
            <p className="hint hint--warn">{t('notFound')}</p>
          ) : unsaved ? (
            <p className="hint">{t('willAddNumber')}</p>
          ) : null}
        </div>

        <div className="field field--period">
          <span className="label label--sub" id={`${id}-period`}>
            {t('billMonth')}
          </span>
          <div className="row row--tight" role="group" aria-labelledby={`${id}-period`}>
            <select
              className="input grow"
              aria-label={t('month')}
              value={f.month}
              onChange={(e) => onChange({ month: Number(e.target.value) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {labels.monthName(m)}
                </option>
              ))}
            </select>
            <select
              className="input input--year"
              aria-label={t('year')}
              value={f.year}
              onChange={(e) => onChange({ year: Number(e.target.value) })}
            >
              {availableYears().map((y) => (
                <option key={y} value={y}>
                  {labels.formatNumber(y)}
                </option>
              ))}
            </select>
          </div>
          {existing ? (
            <p className="hint hint--warn">{t('billReplaced', { month: labels.formatPeriod(f.year, f.month) })}</p>
          ) : miss('month') ? (
            <p className="hint hint--warn">{t('notFound')}</p>
          ) : null}
        </div>

        <div className="field">
          <label className="label label--sub" htmlFor={`${id}-amt`}>
            {t('amount')}
          </label>
          <input
            id={`${id}-amt`}
            className={`input mono ${showErr('amount') ? 'is-invalid' : ''}`}
            inputMode="decimal"
            value={f.amount}
            onChange={(e) => onChange({ amount: e.target.value.replace(/[^\d.]/g, '') })}
          />
          {showErr('amount') ? (
            <p className="error">{t('errAmount')}</p>
          ) : miss('amount') ? (
            <p className="hint hint--warn">{t('notFound')}</p>
          ) : null}
        </div>

        <div className="field">
          <label className="label label--sub" htmlFor={`${id}-late`}>
            {t('lateAmount')}
          </label>
          <input
            id={`${id}-late`}
            className="input mono"
            inputMode="decimal"
            value={f.lateAmount}
            onChange={(e) => onChange({ lateAmount: e.target.value.replace(/[^\d.]/g, '') })}
          />
        </div>

        <div className="field">
          <label className="label label--sub" htmlFor={`${id}-units`}>
            {t('units')}
          </label>
          <input
            id={`${id}-units`}
            className="input mono"
            inputMode="decimal"
            value={f.units}
            onChange={(e) => onChange({ units: e.target.value.replace(/[^\d.]/g, '') })}
          />
          {miss('units') && !f.units && <p className="hint hint--warn">{t('notFound')}</p>}
        </div>

        <div className="field">
          <label className="label label--sub" htmlFor={`${id}-due`}>
            {t('dueDate')}
          </label>
          <input
            id={`${id}-due`}
            type="date"
            className="input"
            value={f.dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value })}
          />
          {miss('dueDate') && !f.dueDate && <p className="hint hint--warn">{t('notFound')}</p>}
        </div>
      </fieldset>
    </div>
  )
}
