import { Coins, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BAJUS_URL, sanitizeGoldPrices, type GoldPrices } from '../lib/gold'
import { useI18n } from '../lib/i18n'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

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
    <Card aria-labelledby="gold-title" aria-busy={gold === null}>
      <CardHeader>
        <CardTitle id="gold-title">
          <span className="grid size-7 place-items-center rounded-md bg-gold-soft text-gold" aria-hidden="true">
            <Coins className="size-4" />
          </span>
          {t('goldTitle')}
        </CardTitle>
        <a
          className="-my-1.5 inline-flex items-center gap-1 py-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href={loaded?.source ?? BAJUS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          BAJUS <ExternalLink className="size-3" />
        </a>
      </CardHeader>
      {gold === 'error' ? (
        <p className="text-sm text-muted-foreground">{t('goldError')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            {(loaded?.prices ?? [{ karat: 22 }, { karat: 21 }]).map((p) => (
              <div key={p.karat} className="rounded-lg border bg-linear-to-br from-gold-soft/70 to-transparent p-3.5">
                <dt className="text-xs font-semibold tracking-wide text-gold uppercase">
                  {t('goldKarat', { karat: formatNumber(p.karat) })}
                </dt>
                <dd className="mt-1 flex items-baseline gap-1.5 text-xl font-semibold tabular sm:text-2xl">
                  {'perVori' in p ? formatMoney(p.perVori) : <Skeleton className="h-7 w-28" />}
                  <span className="text-xs font-normal text-muted-foreground">{t('goldPerVori')}</span>
                </dd>
                <dd className="mt-0.5 min-h-4 text-xs text-muted-foreground tabular">
                  {'perGram' in p ? t('goldPerGram', { price: formatMoney(p.perGram) }) : ''}
                </dd>
              </div>
            ))}
          </dl>
          <p className="min-h-4 text-xs text-muted-foreground">
            {loaded ? t('goldSince', { date: formatDate(loaded.since.slice(0, 10)) }) : ''}
          </p>
        </>
      )}
    </Card>
  )
}
