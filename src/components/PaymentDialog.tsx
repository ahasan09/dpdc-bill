import { useId, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { todayIso, type BillSummary } from '../lib/userData'
import { Dialog } from './Dialog'
import { Button } from './ui/button'
import { DialogFooter } from './ui/dialog'
import { Field, FieldMessage } from './ui/field'
import { Input } from './ui/input'
import { Label } from './ui/label'

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
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(bill, date)
      }}
    >
      <Field>
        <Label htmlFor={id}>{t('paidOn')}</Label>
        <Input id={id} type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} />
        <FieldMessage>{t('paidLockedNote')}</FieldMessage>
      </Field>
      <DialogFooter>
        {bill.paidOn && (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive sm:mr-auto" onClick={() => onSave(bill, null)}>
            {t('markUnpaid')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={!valid}>
          {bill.paidOn ? t('save') : t('markPaid')}
        </Button>
      </DialogFooter>
    </form>
  )
}
