import { Clock, ExternalLink } from 'lucide-react'
import { buildBillUrl } from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import { openBillFromLink } from '../lib/openBill'
import { clearHistory, recordCheck, type UserData } from '../lib/userData'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'

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
    <Card aria-labelledby="history-title">
      <CardHeader>
        <CardTitle id="history-title">{t('historyTitle')}</CardTitle>
        {data.history.length > 0 && (
          <Button variant="ghost" size="xs" onClick={clear}>
            {t('clearHistory')}
          </Button>
        )}
      </CardHeader>

      {data.history.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t('noHistory')}</p>
      ) : (
        <ul className="-mx-2 grid">
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
                    className="group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className={cn('min-w-0 truncate font-medium', !name && 'font-mono')}>{name || h.customerNo}</span>
                    <Badge variant="muted">{type}</Badge>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">
                      {shortMonth(h.month)} {formatNumber(h.year)} · {relativeTime(h.checkedAt)}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </a>
                </li>
              )
            })}
        </ul>
      )}
    </Card>
  )
}
