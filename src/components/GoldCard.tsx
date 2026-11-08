import { useEffect, useState } from 'react'
import { BAJUS_URL, sanitizeGoldPrices, type GoldPrices } from '../lib/gold'
import { useI18n } from '../lib/i18n'
import { Icon } from './Icon'

/** Gold prices per vori in Bangladesh, from gold.json (kept up to date by scripts/sync-gold.sh). */
export function GoldCard() {
  const { t, formatMoney, formatNumber, formatDate } = useI18n()
  const [gold, setGold] = useState<GoldPrices | null | 'error'>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}gold.json`, { cache: 'no-cache', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setGold(sanitizeGoldPrices(json) ?? 'error'))
      .catch(() => {
        if (!controller.signal.aborted) setGold('error')
      })
    return () => controller.abort()
  }, [])

  const loaded = gold !== null && gold !== 'error' ? gold : null

  return (
    <section className="card gold" aria-labelledby="gold-title" aria-busy={gold === null}>
      <div className="card__head">
        <h2 id="gold-title" className="card__title">
          {t('goldTitle')}
        </h2>
        <a className="link gold__source" href={loaded?.source ?? BAJUS_URL} target="_blank" rel="noopener noreferrer">
          BAJUS <Icon name="external" size={13} />
        </a>
      </div>
      {gold === 'error' ? (
        <p className="muted">{t('goldError')}</p>
      ) : (
        <>
          <dl className="gold__grid">
            {(loaded?.prices ?? [{ karat: 22 }, { karat: 21 }]).map((p) => (
              <div key={p.karat} className="gold__item">
                <dt className="gold__karat">{t('goldKarat', { karat: formatNumber(p.karat) })}</dt>
                <dd className="gold__price">
                  {'perVori' in p ? formatMoney(p.perVori) : '—'}
                  <span className="gold__unit">{t('goldPerVori')}</span>
                </dd>
                <dd className="gold__meta">{'perGram' in p ? t('goldPerGram', { price: formatMoney(p.perGram) }) : ' '}</dd>
              </div>
            ))}
          </dl>
          <p className="gold__meta">{loaded ? t('goldSince', { date: formatDate(loaded.since.slice(0, 10)) }) : ' '}</p>
        </>
      )}
    </section>
  )
}
