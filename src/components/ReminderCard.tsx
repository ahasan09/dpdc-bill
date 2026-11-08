import { useId, useState } from 'react'
import { buildReminderIcs, downloadFile } from '../lib/calendar'
import { BILL_READY_DAY } from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import { Icon } from './Icon'
import { useToast } from './Toast'

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
    <section className="card" aria-labelledby="reminder-title">
      <div className="card__head">
        <h2 id="reminder-title" className="card__title">
          {t('reminderTitle')}
        </h2>
      </div>
      <p className="muted">{t('reminderBody')}</p>
      <div className="row row--end">
        <div className="field grow">
          <label htmlFor={id} className="label label--sub">
            {t('reminderDay')}
          </label>
          <select id={id} className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {formatNumber(d)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn--soft" onClick={add}>
          <Icon name="calendar" /> {t('reminderButton')}
        </button>
      </div>
    </section>
  )
}
