import { useEffect, useState } from 'react'
import { BAJUS_URL, sanitizeGoldPrice, type GoldPrice } from '../lib/gold'
import { useI18n } from '../lib/i18n'
import { Icon } from './Icon'

/** 21K gold price per vori in Bangladesh, from gold.json (kept up to date by a scheduled workflow). */
export function GoldCard() {
  const { t, formatMoney, formatNumber, formatDate } = useI18n()
  const [price, setPrice] = useState<GoldPrice | null | 'error'>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}gold.json`, { cache: 'no-cache', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setPrice(sanitizeGoldPrice(json) ?? 'error'))
      .catch(() => {
        if (!controller.signal.aborted) setPrice('error')
      })
    return () => controller.abort()
  }, [])

  const loaded = price !== null && price !== 'error' ? price : null

  return (
    <section className="card gold" aria-labelledby="gold-title" aria-busy={price === null}>
      <div className="card__head">
        <h2 id="gold-title" className="card__title">
          {t('goldTitle', { karat: formatNumber(loaded?.karat ?? 21) })}
        </h2>
        <a className="link gold__source" href={loaded?.source ?? BAJUS_URL} target="_blank" rel="noopener noreferrer">
          BAJUS <Icon name="external" size={13} />
        </a>
      </div>
      {price === 'error' ? (
        <p className="muted">{t('goldError')}</p>
      ) : (
        <>
          <p className="gold__price">
            {loaded ? formatMoney(loaded.perVori) : '—'}
            <span className="gold__unit">{t('goldPerVori')}</span>
          </p>
          <p className="gold__meta">
            {loaded
              ? t('goldMeta', { perGram: formatMoney(loaded.perGram), date: formatDate(loaded.since.slice(0, 10)) })
              : ' '}
          </p>
        </>
      )}
    </section>
  )
}
