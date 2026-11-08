import { useId, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { todayIso, type BillSummary } from '../lib/userData'
import { Dialog } from './Dialog'

type OnSave = (bill: BillSummary, paidOn: string | null) => void

/** Marks a bill paid on a date, changes that date, or marks it unpaid again. */
export function PaymentDialog({
  bill,
  onClose,
  onSave,
}: {
  bill: BillSummary | null
  onClose: () => void
  /** null marks the bill unpaid. */
  onSave: OnSave
}) {
  const { t, formatPeriod, formatMoney } = useI18n()
  return (
    <Dialog
      open={bill !== null}
      onClose={onClose}
      title={bill?.paidOn ? t('editPayment') : t('markPaid')}
      subtitle={
        bill
          ? `${formatPeriod(bill.year, bill.month)}${bill.amount != null ? ` · ${formatMoney(bill.amount)}` : ''}`
          : undefined
      }
    >
      {bill && <PaymentForm key={bill.id} bill={bill} onClose={onClose} onSave={onSave} />}
    </Dialog>
  )
}

function PaymentForm({ bill, onClose, onSave }: { bill: BillSummary; onClose: () => void; onSave: OnSave }) {
  const { t } = useI18n()
  const id = useId()
  const today = todayIso()
  const [date, setDate] = useState(bill.paidOn ?? today)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(bill, date)
      }}
    >
      <div className="field">
        <label htmlFor={id} className="label label--sub">
          {t('paidOn')}
        </label>
        <input
          id={id}
          type="date"
          className="input"
          value={date}
          max={today}
          required
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <p className="hint">{t('paidLockedNote')}</p>
      <div className="dialog__actions">
        {bill.paidOn && (
          <button type="button" className="btn btn--ghost btn--danger-text" onClick={() => onSave(bill, null)}>
            {t('markUnpaid')}
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('cancel')}
        </button>
        <button type="submit" className="btn btn--primary" disabled={!valid}>
          {bill.paidOn ? t('save') : t('markPaid')}
        </button>
      </div>
    </form>
  )
}
