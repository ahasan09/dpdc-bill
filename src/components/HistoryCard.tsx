import { buildBillUrl } from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import { openBillFromLink } from '../lib/openBill'
import { clearHistory, recordCheck, type UserData } from '../lib/userData'
import { Icon } from './Icon'
import { useToast } from './Toast'

export function HistoryCard({ data, update }: { data: UserData; update: (fn: (d: UserData) => UserData) => void }) {
  const { t, formatPeriod, relativeTime } = useI18n()
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
            {t('clearHistory')}
          </button>
        )}
      </div>

      {data.history.length === 0 ? (
        <p className="empty">{t('noHistory')}</p>
      ) : (
        <ul className="list">
          {data.history.map((h) => {
            const url = buildBillUrl({ ...h, email: data.email })
            const name = data.accounts.find((a) => a.customerNo === h.customerNo)?.nickname || h.nickname
            return (
              <li key={h.id}>
                <a
                  className="list__item list__item--link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t('openAgain')}: ${name || h.customerNo}, ${t(`bt_${h.billType}` as MessageKey)}, ${formatPeriod(h.year, h.month)}`}
                  onClick={(e) => {
                    openBillFromLink(e, url)
                    update((d) => recordCheck(d, h))
                  }}
                >
                  <span className="list__icon" aria-hidden="true">
                    <Icon name="clock" />
                  </span>
                  <span className="list__main">
                    <span className="list__title">
                      {name || <span className="mono">{h.customerNo}</span>}
                      <span className="badge badge--muted">{t(`bt_${h.billType}` as MessageKey)}</span>
                    </span>
                    <span className="list__meta">
                      {formatPeriod(h.year, h.month)}
                      {name && <span className="mono"> · {h.customerNo}</span>} · {relativeTime(h.checkedAt)}
                    </span>
                  </span>
                  <Icon name="external" className="list__chevron" />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
