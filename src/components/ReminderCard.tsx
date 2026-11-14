import { CalendarPlus } from 'lucide-react'
import { useId, useState } from 'react'
import { buildReminderIcs, downloadFile } from '../lib/calendar'
import { BILL_READY_DAY } from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Field } from './ui/field'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const KEY = 'dpdc-bill-check:reminder-day'

export function ReminderCard() {
  const { t, formatNumber } = useI18n()
  const toast = useToast()
  const id = useId()
  const [day, setDay] = useState(() => {
    try {
      const n = Number(localStorage.getItem(KEY))
      return n >= 1 && n <= 28 ? n : BILL_READY_DAY
    } catch {
      return BILL_READY_DAY
    }
  })

  function add() {
    try {
      localStorage.setItem(KEY, String(day))
    } catch {
      /* ignore */
    }
    const appUrl = window.location.origin + window.location.pathname
    downloadFile(
      'dpdc-bill-reminder.ics',
      buildReminderIcs({ day, title: t('reminderEventTitle'), description: `${t('reminderEventBody')} ${appUrl}`, url: appUrl }),
      'text/calendar',
    )
    toast(t('reminderDownloaded'))
  }

  return (
    <Card aria-labelledby="reminder-title">
      <CardHeader>
        <CardTitle id="reminder-title">{t('reminderTitle')}</CardTitle>
      </CardHeader>
      <CardDescription className="-mt-2">{t('reminderBody')}</CardDescription>
      <div className="flex items-end gap-2">
        <Field className="flex-1">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {t('reminderDay')}
          </Label>
          <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {formatNumber(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button variant="secondary" onClick={add}>
          <CalendarPlus /> {t('reminderButton')}
        </Button>
      </div>
    </Card>
  )
}
