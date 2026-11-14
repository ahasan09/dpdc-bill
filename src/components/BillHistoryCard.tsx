import { Check, Ellipsis, Lock, Pencil, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { accountLabel } from '../lib/labels'
import {
  addAccount,
  billStatus,
  billsFor,
  defaultAccount,
  findAccountByNo,
  removeBill,
  setBillPaid,
  todayIso,
  upsertBill,
  type BillSummary,
  type UserData,
} from '../lib/userData'
import { BillChart } from './BillChart'
import { BillImportDialog, type NewBill } from './BillImportDialog'
import { cn } from '@/lib/utils'
import { PaymentDialog } from './PaymentDialog'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

const statusVariant = { paid: 'success', unpaid: 'warning', overdue: 'destructive' } as const

type Update = (fn: (d: UserData) => UserData) => void

export function BillHistoryCard({ data, update }: { data: UserData; update: Update }) {
  const { t, formatMoney, formatQuantity, formatPeriod, formatDate, shortMonth, formatNumber } = useI18n()
  const shortPeriod = (b: { year: number; month: number }) => `${shortMonth(b.month)} ${formatNumber(b.year)}`
  const readingText = (b: BillSummary) =>
    b.previousReading != null || b.presentReading != null
      ? `${b.previousReading != null ? formatQuantity(b.previousReading) : '—'} → ${b.presentReading != null ? formatQuantity(b.presentReading) : '—'}`
      : '—'
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [request, setRequest] = useState<File[] | 'manual' | { edit: BillSummary } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [paying, setPaying] = useState<BillSummary | null>(null)

  // Numbers that have bills: saved numbers in their saved order first, then any others.
  const numbers = useMemo(() => {
    const withBills = new Set(data.bills.map((b) => b.customerNo))
    const saved = data.accounts.map((a) => a.customerNo).filter((no) => withBills.has(no))
    return [...saved, ...[...withBills].filter((no) => !saved.includes(no))]
  }, [data.bills, data.accounts])

  const preferred = defaultAccount(data)?.customerNo
  const selected =
    picked && numbers.includes(picked) ? picked : preferred && numbers.includes(preferred) ? preferred : numbers[0]
  const bills = selected ? billsFor(data, selected) : []
  const recent = bills.slice(0, 12).filter((b) => b.amount !== null)
  const latest = bills[0]
  const average = recent.length ? recent.reduce((sum, b) => sum + (b.amount ?? 0), 0) / recent.length : null
  const highest = recent.reduce<BillSummary | null>((m, b) => (!m || (b.amount ?? 0) > (m.amount ?? 0) ? b : m), null)
  const today = todayIso()
  const unpaid = bills.filter((b) => !b.paidOn)
  const unpaidTotal = unpaid.reduce((sum, b) => sum + (b.amount ?? 0), 0)
  const anyOverdue = unpaid.some((b) => billStatus(b, today) === 'overdue')

  const nameFor = (no: string) => {
    const account = findAccountByNo(data, no)
    return account ? accountLabel(account, t) : no
  }

  function openFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (files.length) setRequest(files)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    openFiles(e.dataTransfer.files)
  }

  function save(newBills: NewBill[], replaceId?: string) {
    update((d) => {
      let next = replaceId ? removeBill(d, replaceId) : d
      for (const bill of newBills) {
        if (!findAccountByNo(next, bill.customerNo)) next = addAccount(next, { customerNo: bill.customerNo, nickname: '' })
        next = upsertBill(next, bill)
      }
      return next
    })
    if (newBills[0]) setPicked(newBills[0].customerNo)
    setRequest(null)
    toast(t('billsSaved', { count: newBills.length }))
  }

  function setPaid(bill: BillSummary, paidOn: string | null) {
    update((d) => setBillPaid(d, bill.id, paidOn))
    setPaying(null)
    const month = formatPeriod(bill.year, bill.month)
    if (paidOn && !bill.paidOn) {
      toast(t('billMarkedPaid', { month }), {
        action: { label: t('undo'), onClick: () => update((d) => setBillPaid(d, bill.id, null)) },
      })
    } else if (!paidOn) {
      toast(t('billMarkedUnpaid', { month }), {
        action: { label: t('undo'), onClick: () => update((d) => setBillPaid(d, bill.id, bill.paidOn)) },
      })
    }
  }

  function remove(bill: BillSummary) {
    update((d) => removeBill(d, bill.id))
    toast(t('billDeleted', { month: formatPeriod(bill.year, bill.month) }), {
      action: {
        label: t('undo'),
        onClick: () => update((d) => upsertBill(d, bill, bill.addedAt)),
      },
    })
  }

  return (
    <Card
      className={cn('relative', dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
      aria-labelledby="bills-title"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <CardHeader>
        <CardTitle id="bills-title" className="text-lg whitespace-nowrap">
          {t('billsTitle')}
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" title={t('addManually')} aria-label={t('addManually')} onClick={() => setRequest('manual')}>
            <Plus /> <span className="hidden sm:inline">{t('addManually')}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            title={t('uploadBills')}
            aria-label={t('uploadBills')}
            onClick={() => fileRef.current?.click()}
          >
            <Upload /> <span className="hidden min-[400px]:inline">{t('uploadBills')}</span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              openFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </CardHeader>

      {numbers.length === 0 ? (
        <button
          type="button"
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 px-6 py-10 text-center outline-none transition-colors hover:border-primary/50 hover:bg-secondary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => fileRef.current?.click()}
        >
          <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
            <Upload className="size-5" />
          </span>
          <span className="font-semibold">{t('uploadBills')}</span>
          <span className="max-w-md text-sm text-muted-foreground">{t('billsEmpty')}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" /> {t('billsPrivacy')}
          </span>
        </button>
      ) : (
        <>
          {numbers.length > 1 && (
            <ToggleGroup
              type="single"
              value={selected}
              onValueChange={(v) => v && setPicked(v)}
              aria-label={t('savedAccounts')}
              className="h-auto w-auto max-w-full flex-wrap justify-start"
            >
              {numbers.map((no) => (
                <ToggleGroupItem key={no} value={no} className="flex-none">
                  {nameFor(no)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label={t('latestBill')}
              value={latest?.amount != null ? formatMoney(latest.amount) : '—'}
              meta={latest && shortPeriod(latest)}
              highlight
            />
            <Stat label={t('average', { n: recent.length })} value={average !== null ? formatMoney(Math.round(average)) : '—'} />
            <Stat
              label={t('highest')}
              value={highest?.amount != null ? formatMoney(highest.amount) : '—'}
              meta={highest && shortPeriod(highest)}
            />
          </dl>

          {recent.length > 1 && <BillChart bills={bills} />}

          {unpaid.length > 0 && unpaidTotal > 0 && (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                anyOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning-soft text-warning',
              )}
              role="status"
            >
              {t('unpaidSummary', { count: unpaid.length, amount: formatMoney(unpaidTotal) })}
            </p>
          )}

          <Table className="tabular max-sm:[&_td]:px-1.5 max-sm:[&_th]:px-1.5 max-sm:[&_thead_th]:whitespace-normal max-sm:[&_thead_th]:leading-tight">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">{t('billMonth')}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t('amount')}
                </TableHead>
                <TableHead scope="col" className="hidden text-right lg:table-cell">
                  {t('lateAmountShort')}
                </TableHead>
                <TableHead scope="col" className="hidden text-right sm:table-cell">
                  {t('units')}
                </TableHead>
                <TableHead scope="col" className="hidden text-right lg:table-cell">
                  {t('meterReading')}
                </TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  {t('dueDate')}
                </TableHead>
                <TableHead scope="col">{t('status')}</TableHead>
                <TableHead scope="col">
                  <span className="sr-only">{t('edit')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => {
                const status = billStatus(b, today)
                const period = formatPeriod(b.year, b.month)
                return (
                  <TableRow key={b.id} className={cn('group', status === 'paid' && 'text-muted-foreground')}>
                    <th scope="row" className="p-2 text-left font-medium whitespace-nowrap text-foreground">
                      <span className="hidden sm:inline">{formatPeriod(b.year, b.month)}</span>
                      <span className="sm:hidden">
                        {shortMonth(b.month)}
                        <span className="block text-xs font-normal text-muted-foreground">{formatNumber(b.year)}</span>
                      </span>
                    </th>
                    <TableCell className="text-right font-medium text-foreground">
                      {b.amount != null ? formatMoney(b.amount) : '—'}
                      {b.units != null && (
                        <span className="block text-xs font-normal text-muted-foreground sm:hidden">{formatQuantity(b.units)} kWh</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                      {b.lateAmount != null ? formatMoney(b.lateAmount) : '—'}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{b.units != null ? formatQuantity(b.units) : '—'}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{readingText(b)}</TableCell>
                    <TableCell className="hidden md:table-cell">{b.dueDate ? formatDate(b.dueDate) : t('noDueDate')}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="-my-1.5 rounded-full py-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        title={b.paidOn ? `${t('paidOn')} ${formatDate(b.paidOn)} · ${t('editPayment')}` : t('markPaid')}
                        aria-label={`${period}: ${t(status)}${b.paidOn ? `, ${t('paidOn')} ${formatDate(b.paidOn)}` : ''}. ${b.paidOn ? t('editPayment') : t('markPaid')}`}
                        onClick={() => setPaying(b)}
                      >
                        <Badge variant={statusVariant[status]} className="hover:brightness-95">
                          {status === 'paid' && <Check />}
                          {/* Phones show only the tick for paid bills; the button's label still says "paid". */}
                          <span className={cn(status === 'paid' && 'max-sm:sr-only')}>{t(status)}</span>
                          {b.paidOn && <span className="hidden lg:inline"> · {formatDate(b.paidOn)}</span>}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="w-0 text-right">
                      {b.paidOn ? (
                        <span className="inline-grid size-8 place-items-center text-muted-foreground/70" title={t('paidLockedNote')}>
                          <Lock className="size-3.5" />
                          <span className="sr-only">{t('paidLockedNote')}</span>
                        </span>
                      ) : (
                        <>
                        {/* Phones: one menu so the table fits; wider screens: the three buttons. */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground sm:hidden"
                              aria-label={`${t('moreActions')}: ${period}`}
                            >
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[10rem]">
                            <DropdownMenuItem onSelect={() => setPaying(b)}>
                              <Check className="text-success" /> {t('markPaid')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setRequest({ edit: b })}>
                              <Pencil /> {t('editBill')}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onSelect={() => remove(b)}>
                              <Trash2 /> {t('deleteBill')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="hidden justify-end gap-0.5 sm:flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-success hover:bg-success-soft hover:text-success"
                            title={t('markPaid')}
                            aria-label={`${t('markPaid')}: ${period}`}
                            onClick={() => setPaying(b)}
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            title={t('editBill')}
                            aria-label={`${t('editBill')}: ${period}`}
                            onClick={() => setRequest({ edit: b })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title={t('deleteBill')}
                            aria-label={`${t('deleteBill')}: ${period}`}
                            onClick={() => remove(b)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}

      {dragging && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-background/85 text-base font-semibold text-primary backdrop-blur-sm"
          aria-hidden="true"
        >
          <Upload className="size-6" /> {t('dropHere')}
        </div>
      )}

      <PaymentDialog bill={paying} onClose={() => setPaying(null)} onSave={setPaid} />

      <BillImportDialog
        request={request}
        data={data}
        defaultCustomerNo={selected}
        onClose={() => setRequest(null)}
        onSave={save}
      />
    </Card>
  )
}

function Stat({ label, value, meta, highlight }: { label: string; value: string; meta?: string | null; highlight?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-lg border p-2.5 sm:p-3', highlight ? 'border-primary/20 bg-secondary/60' : 'bg-muted/40')}>
      <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular min-[400px]:text-base sm:text-xl">
        <span className="block">{value}</span>
        {meta && <span className="block text-xs font-normal text-muted-foreground">{meta}</span>}
      </dd>
    </div>
  )
}
