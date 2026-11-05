import { buildBillUrl } from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import { openBillFromLink } from '../lib/openBill'
import { clearHistory, recordCheck, type UserData } from '../lib/userData'
import { Icon } from './Icon'
import { useToast } from './Toast'

export function HistoryCard({ data, update }: { data: UserData; update: (fn: (d: UserData) => UserData) => void }) {
  const { t, formatPeriod, relativeTime, shortMonth, formatNumber } = useI18n()
  const toast = useToast()

  function clear() {
    const previous = data.history
    update(clearHistory)
    toast(t('clearHistory'), {
      action: { label: t('undo'), onClick: () => update((d) => ({ ...d, history: previous })) },
    })
  }

  return (
    <section className="card" aria-labelledby="history-title">
      <div className="card__head">
        <h2 id="history-title" className="card__title">
          {t('historyTitle')}
        </h2>
        {data.history.length > 0 && (
          <button type="button" className="btn btn--ghost btn--xs" onClick={clear}>
            {t('clearHistory')}
          </button>
        )}
      </div>

      {data.history.length === 0 ? (
        <p className="empty">{t('noHistory')}</p>
      ) : (
        <ul className="list list--compact">
          {[...data.history]
            .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month) || b.checkedAt - a.checkedAt)
            .map((h) => {
              const url = buildBillUrl({ ...h, email: data.email })
              const name = data.accounts.find((a) => a.customerNo === h.customerNo)?.nickname || h.nickname
              const type = t(`bt_${h.billType}` as MessageKey)
              return (
                <li key={h.id}>
                  {/* One line per check; the customer number is in the tooltip and the accessible name. */}
                  <a
                    className="list__item list__item--link check-row"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${name ? `${name} · ` : ''}${h.customerNo} · ${type} · ${formatPeriod(h.year, h.month)}`}
                    aria-label={`${t('openAgain')}: ${name || h.customerNo}, ${type}, ${formatPeriod(h.year, h.month)}`}
                    onClick={(e) => {
                      openBillFromLink(e, url)
                      update((d) => recordCheck(d, h))
                    }}
                  >
                    <Icon name="clock" size={14} className="check-row__icon" />
                    <span className={`check-row__name ${name ? '' : 'mono'}`}>{name || h.customerNo}</span>
                    <span className="badge badge--muted">{type}</span>
                    <span className="check-row__meta">
                      {shortMonth(h.month)} {formatNumber(h.year)} · {relativeTime(h.checkedAt)}
                    </span>
                    <Icon name="external" size={14} className="list__chevron" />
                  </a>
                </li>
              )
            })}
        </ul>
      )}
    </section>
  )
}
