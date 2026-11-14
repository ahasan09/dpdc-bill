import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { parseBillText } from '../lib/billParser'
import { availableYears, latestBillPeriod, normalizeCustomerNo, validateCustomerNo } from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import { accountLabel } from '../lib/labels'
import { PdfReadError, extractPdfText } from '../lib/pdfText'
import { findAccountByNo, findBill, type BillSummary, type UserData } from '../lib/userData'
import { cn } from '@/lib/utils'
import { Dialog } from './Dialog'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { DialogFooter } from './ui/dialog'
import { Field, FieldMessage } from './ui/field'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export type NewBill = Omit<BillSummary, 'id' | 'addedAt' | 'paidOn'>

interface Form {
  customerNo: string
  year: number
  month: number
  amount: string
  lateAmount: string
  units: string
  presentReading: string
  previousReading: string
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

const optionalNumber = (v: string) => (v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

/** Typing a reading fills in units (present − previous) while units is empty or was derived. */
function withUnits(f: Form, patch: Partial<Form>): Partial<Form> {
  const next = { ...f, ...patch }
  const pres = optionalNumber(next.presentReading)
  const prev = optionalNumber(next.previousReading)
  const oldDerived =
    optionalNumber(f.presentReading) !== null && optionalNumber(f.previousReading) !== null
      ? String(Math.round((Number(f.presentReading) - Number(f.previousReading)) * 100) / 100)
      : null
  if (pres !== null && prev !== null && pres >= prev && (f.units === '' || f.units === oldDerived)) {
    return { ...patch, units: String(Math.round((pres - prev) * 100) / 100) }
  }
  return patch
}

function blankForm(data: UserData, customerNo?: string): Form {
  const last = latestBillPeriod()
  const no = customerNo ?? data.accounts.find((a) => a.id === data.defaultAccountId)?.customerNo ?? ''
  return { customerNo: no, year: last.year, month: last.month, amount: '', lateAmount: '', units: '', presentReading: '', previousReading: '', dueDate: '' }
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
            presentReading: b.presentReading !== null ? String(b.presentReading) : '',
            previousReading: b.previousReading !== null ? String(b.previousReading) : '',
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
              presentReading: parsed.presentReading !== null ? String(parsed.presentReading) : '',
              previousReading: parsed.previousReading !== null ? String(parsed.previousReading) : '',
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
    // A paid bill is locked, so a new upload can't replace it.
    paid: validateCustomerNo(f.customerNo) === null && !!findBill(data, f.customerNo, f.year, f.month)?.paidOn,
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
        presentReading: optionalNumber(it.form.presentReading),
        previousReading: optionalNumber(it.form.previousReading),
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
      <div className="grid min-w-0 gap-4">
        <datalist id="saved-numbers">
          {data.accounts.map((a) => (
            <option key={a.id} value={a.customerNo}>
              {accountLabel(a, t)}
            </option>
          ))}
        </datalist>

        <div className="-mx-1 grid max-h-[min(60dvh,560px)] gap-3 overflow-auto px-1">
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

        <FieldMessage>{t('billsPrivacy')}</FieldMessage>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={!canSave} onClick={save}>
            {reading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {editing ? t('save') : t('saveBills', { count: active.length })}
          </Button>
        </DialogFooter>
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
  errors: { customerNo: boolean; amount: boolean; paid: boolean }
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
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground" aria-busy="true">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> {t('reading', { name: item.fileName })}
      </div>
    )
  }
  if (item.status === 'error') {
    return (
      <Alert variant="destructive" role="alert">
        <TriangleAlert />
        <AlertDescription>
          <p className="truncate font-semibold text-foreground">{item.fileName}</p>
          <p>{item.error && t(item.error)}</p>
        </AlertDescription>
      </Alert>
    )
  }

  const validNo = validateCustomerNo(f.customerNo) === null
  const found = validNo ? findBill(data, f.customerNo, f.year, f.month) : undefined
  const existing = found && found.id !== item.key ? found : undefined
  const unsaved = validNo && !findAccountByNo(data, f.customerNo)
  const showErr = (k: 'customerNo' | 'amount') => touched && errors[k]
  const notFound = <FieldMessage tone="warn">{t('notFound')}</FieldMessage>

  const numberInput = (key: 'amount' | 'lateAmount' | 'units' | 'previousReading' | 'presentReading', label: string, after?: ReactNode) => (
    <Field>
      <Label className="text-xs text-muted-foreground" htmlFor={`${id}-${key}`}>
        {label}
      </Label>
      <Input
        id={`${id}-${key}`}
        className="font-mono"
        inputMode="decimal"
        value={f[key]}
        aria-invalid={key === 'amount' && showErr('amount') ? true : undefined}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, '')
          onChange(key === 'previousReading' || key === 'presentReading' ? withUnits(f, { [key]: v }) : { [key]: v })
        }}
      />
      {after}
    </Field>
  )

  return (
    <div className={cn('grid min-w-0 gap-3 rounded-lg border bg-muted/40 p-3.5')}>
      {item.fileName && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold" title={item.fileName}>
            {item.fileName}
          </p>
          <Label className="shrink-0 text-xs font-normal">
            <Checkbox checked={item.skipped} onCheckedChange={(c) => onSkip(c === true)} />
            {t('skipFile')}
          </Label>
        </div>
      )}
      {item.warning && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>{t(item.warning)}</AlertDescription>
        </Alert>
      )}

      <fieldset
        className={cn('grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4', item.skipped && 'opacity-45')}
        disabled={item.skipped}
      >
        <legend className="sr-only">{item.fileName || t('manualTitle')}</legend>
        <Field className="col-span-2">
          <Label className="text-xs text-muted-foreground" htmlFor={`${id}-no`}>
            {t('customerNo')}
          </Label>
          <Input
            id={`${id}-no`}
            className="font-mono"
            inputMode="numeric"
            list="saved-numbers"
            autoComplete="off"
            value={f.customerNo}
            aria-invalid={showErr('customerNo') || undefined}
            onChange={(e) => onChange({ customerNo: e.target.value })}
          />
          {showErr('customerNo') ? (
            <FieldMessage tone="error">{t('errLength', { min: 6, max: 12 })}</FieldMessage>
          ) : miss('customerNo') ? (
            notFound
          ) : unsaved ? (
            <FieldMessage>{t('willAddNumber')}</FieldMessage>
          ) : null}
        </Field>

        <Field className="col-span-2">
          <span className="text-xs font-medium text-muted-foreground" id={`${id}-period`}>
            {t('billMonth')}
          </span>
          <div className="flex gap-2" role="group" aria-labelledby={`${id}-period`}>
            <Select value={String(f.month)} onValueChange={(v) => onChange({ month: Number(v) })} disabled={item.skipped}>
              <SelectTrigger aria-label={t('month')} className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {labels.monthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(f.year)} onValueChange={(v) => onChange({ year: Number(v) })} disabled={item.skipped}>
              <SelectTrigger aria-label={t('year')} className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears().map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {labels.formatNumber(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {errors.paid && !item.skipped ? (
            <FieldMessage tone="error">{t('billPaidLocked', { month: labels.formatPeriod(f.year, f.month) })}</FieldMessage>
          ) : existing ? (
            <FieldMessage tone="warn">{t('billReplaced', { month: labels.formatPeriod(f.year, f.month) })}</FieldMessage>
          ) : miss('month') ? (
            notFound
          ) : null}
        </Field>

        {numberInput(
          'amount',
          t('amount'),
          showErr('amount') ? <FieldMessage tone="error">{t('errAmount')}</FieldMessage> : miss('amount') ? notFound : null,
        )}
        {numberInput('lateAmount', t('lateAmount'))}
        {numberInput('units', t('units'), miss('units') && !f.units ? notFound : null)}
        {numberInput('previousReading', t('previousReading'))}
        {numberInput('presentReading', t('presentReading'))}
        <Field>
          <Label className="text-xs text-muted-foreground" htmlFor={`${id}-due`}>
            {t('dueDate')}
          </Label>
          <Input id={`${id}-due`} type="date" value={f.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
          {miss('dueDate') && !f.dueDate && notFound}
        </Field>
      </fieldset>
    </div>
  )
}
