import { CircleCheck, ChevronDown, Copy, ExternalLink, Plus, Share2, Star, Zap } from 'lucide-react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  BILL_TYPES,
  CUSTOMER_NO_MAX,
  CUSTOMER_NO_MIN,
  availableYears,
  buildBillUrl,
  billReadyDate,
  isBillNotReady,
  latestBillPeriod,
  isValidEmail,
  normalizeCustomerNo,
  validateCustomerNo,
  type BillType,
  type CustomerNoError,
  type Period,
} from '../lib/dpdc'
import { useI18n, type MessageKey } from '../lib/i18n'
import {
  addAccount,
  defaultAccount,
  findAccountByNo,
  recordCheck,
  setEmail,
  type UserData,
} from '../lib/userData'
import { accountLabel } from '../lib/labels'
import { openBillFromLink, type OpenMode } from '../lib/openBill'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Field, FieldMessage } from './ui/field'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

const NEW = '__new__'

const errorKey: Record<CustomerNoError, MessageKey> = {
  empty: 'errEmpty',
  notDigits: 'errNotDigits',
  length: 'errLength',
}

export function CheckBillCard({
  data,
  update,
}: {
  data: UserData
  update: (fn: (d: UserData) => UserData) => void
}) {
  const { t, monthName, formatNumber, formatPeriod } = useI18n()
  const toast = useToast()
  const ids = { cno: useId(), nick: useId(), email: useId(), month: useId(), year: useId() }

  const [selected, setSelected] = useState<string>(() => defaultAccount(data)?.id ?? NEW)
  const [typed, setTyped] = useState('')
  const [nickname, setNickname] = useState('')
  const [saveNumber, setSaveNumber] = useState(true)
  const [billType, setBillType] = useState<BillType>('current')
  const [period, setPeriod] = useState<Period>(() => latestBillPeriod())
  const [email, setEmailInput] = useState(data.email)
  const [touched, setTouched] = useState(false)
  const [opened, setOpened] = useState<{ url: string; mode: OpenMode } | null>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the selection valid as saved numbers load (e.g. from the cloud) or change.
  const accountIds = data.accounts.map((a) => a.id).join(',')
  const defaultId = defaultAccount(data)?.id
  useEffect(() => {
    setSelected((current) => {
      if (current !== NEW && data.accounts.some((a) => a.id === current)) return current
      if (current === NEW && typed !== '') return current
      return defaultId ?? NEW
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds, defaultId])

  useEffect(() => setEmailInput(data.email), [data.email])

  const account = data.accounts.find((a) => a.id === selected)
  const customerNo = account ? account.customerNo : normalizeCustomerNo(typed)
  const cnoError = account ? null : validateCustomerNo(typed)
  const emailError = email.trim() !== '' && !isValidEmail(email)
  const valid = !cnoError && !emailError
  const existing = !account && !cnoError ? findAccountByNo(data, customerNo) : undefined

  const url = useMemo(
    () => (valid ? buildBillUrl({ billType, ...period, customerNo, email }) : null),
    [valid, billType, period, customerNo, email],
  )

  // A month's bill is generated after the 7th of the next month, so the newest ready bill is the default and quick pick.
  const latest = latestBillPeriod()
  const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month
  const years = availableYears()

  function afterOpen(link: string, mode: OpenMode) {
    setOpened({ url: link, mode })
    update((d) => {
      let next = d
      let nick = account?.nickname ?? ''
      if (!account && saveNumber && !existing) {
        next = addAccount(next, { customerNo, nickname })
        const saved = findAccountByNo(next, customerNo)
        nick = saved?.nickname ?? ''
        if (saved) {
          setSelected(saved.id)
          setTyped('')
          setNickname('')
          toast(t('numberSaved', { name: accountLabel(saved, t) }))
        }
      } else if (existing) {
        nick = existing.nickname
      }
      if (email.trim() !== d.email) next = setEmail(next, email)
      return recordCheck(next, { customerNo, nickname: nick, billType, ...period })
    })
  }

  function onLinkClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!url) {
      e.preventDefault()
      setTouched(true)
      inputRef.current?.focus()
      return
    }
    afterOpen(url, openBillFromLink(e, url))
  }

  function onEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      linkRef.current?.click()
    }
  }

  async function copyLink() {
    if (!url) return setTouched(true)
    try {
      await navigator.clipboard.writeText(url)
      toast(t('linkCopied'))
    } catch {
      toast(t('copyFailed'), { tone: 'error' })
    }
  }

  async function share() {
    if (!url) return setTouched(true)
    try {
      await navigator.share({ title: t('appName'), url })
    } catch {
      /* cancelled */
    }
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const pickAccount = (id: string) => {
    setSelected(id)
    setOpened(null)
    if (id === NEW) setTimeout(() => inputRef.current?.focus(), 0)
  }
  const accountCard =
    'flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-all hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-secondary data-[state=checked]:ring-1 data-[state=checked]:ring-primary'

  return (
    <Card
      id="check"
      aria-labelledby="check-title"
      className="relative scroll-mt-20 gap-5 overflow-hidden border-primary/15 p-5 shadow-md sm:p-6"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-primary/70 to-gold" aria-hidden="true" />
      <CardHeader>
        <CardTitle id="check-title" className="text-lg">
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary" aria-hidden="true">
            <Zap className="size-[18px] fill-current" />
          </span>
          {t('checkTitle')}
        </CardTitle>
      </CardHeader>

      <form className="grid gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
        {/* Customer number */}
        <fieldset className="grid gap-2.5">
          <legend className="mb-2.5 text-sm font-medium">
            {data.accounts.length > 0 ? t('savedAccounts') : t('customerNo')}
          </legend>

          {data.accounts.length > 0 && (
            <RadioGroupPrimitive.Root
              value={selected}
              onValueChange={pickAccount}
              aria-label={t('savedAccounts')}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {data.accounts.map((a) => (
                <RadioGroupPrimitive.Item key={a.id} value={a.id} className={accountCard}>
                  <span className="flex w-full items-center gap-1 truncate text-sm font-medium">
                    {a.id === data.defaultAccountId && <Star className="size-3.5 shrink-0 fill-gold text-gold" />}
                    <span className="truncate">{accountLabel(a, t)}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{a.customerNo}</span>
                </RadioGroupPrimitive.Item>
              ))}
              <RadioGroupPrimitive.Item
                value={NEW}
                className={cn(accountCard, 'justify-center border-dashed text-muted-foreground data-[state=checked]:text-foreground')}
              >
                <span className="flex items-center gap-1 text-sm font-medium">
                  <Plus className="size-4" /> {t('otherNumber')}
                </span>
              </RadioGroupPrimitive.Item>
            </RadioGroupPrimitive.Root>
          )}

          {selected === NEW && (
            <div className="grid gap-2.5">
              <Field>
                {data.accounts.length > 0 && (
                  <Label htmlFor={ids.cno} className="text-xs text-muted-foreground">
                    {t('customerNo')}
                  </Label>
                )}
                <Input
                  ref={inputRef}
                  id={ids.cno}
                  className="h-12 font-mono text-lg tracking-wider md:text-lg"
                  inputMode="numeric"
                  autoComplete="off"
                  enterKeyHint="go"
                  placeholder={t('customerNoPlaceholder')}
                  value={typed}
                  maxLength={CUSTOMER_NO_MAX + 6}
                  aria-invalid={touched && !!cnoError}
                  aria-describedby={`${ids.cno}-hint`}
                  onChange={(e) => {
                    setTyped(e.target.value)
                    setOpened(null)
                  }}
                  onBlur={() => typed && setTouched(true)}
                  onKeyDown={onEnter}
                />
                <FieldMessage id={`${ids.cno}-hint`} tone={touched && cnoError ? 'error' : existing ? 'warn' : 'hint'}>
                  {touched && cnoError
                    ? t(errorKey[cnoError], { min: CUSTOMER_NO_MIN, max: CUSTOMER_NO_MAX })
                    : existing
                      ? t('duplicate', { name: accountLabel(existing, t) })
                      : t('customerNoHint')}
                </FieldMessage>
              </Field>

              {!existing && (
                /* "☑ Save as [nickname]" on one row */
                <div className="flex min-h-9 items-center gap-3">
                  <Label className="shrink-0 font-normal" title={t('saveThisNumber')}>
                    <Checkbox checked={saveNumber} onCheckedChange={(c) => setSaveNumber(c === true)} />
                    {saveNumber ? t('saveAs') : t('saveThisNumber')}
                  </Label>
                  {saveNumber && (
                    <Input
                      id={ids.nick}
                      className="flex-1"
                      aria-label={t('nickname')}
                      placeholder={t('nicknamePlaceholder')}
                      value={nickname}
                      maxLength={40}
                      autoComplete="off"
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={onEnter}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </fieldset>

        {/* Bill type */}
        <div className="grid gap-2">
          <ToggleGroup
            type="single"
            value={billType}
            aria-label={t('billType')}
            onValueChange={(v) => {
              if (!v) return
              setBillType(v as BillType)
              setOpened(null)
            }}
          >
            {BILL_TYPES.map((type) => (
              <ToggleGroupItem key={type} value={type}>
                {t(`bt_${type}` as MessageKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {billType !== 'current' && <FieldMessage>{t(`bt_${billType}_desc` as MessageKey)}</FieldMessage>}
        </div>

        {/* Period */}
        <div className="grid gap-2" role="group" aria-label={t('billMonth')}>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={samePeriod(period, latest) ? 'secondary' : 'outline'}
              size="sm"
              className={cn('rounded-full', samePeriod(period, latest) && 'ring-1 ring-primary/40')}
              aria-pressed={samePeriod(period, latest)}
              onClick={() => {
                setPeriod(latest)
                setOpened(null)
              }}
            >
              {t('latestBillChip', { month: monthName(latest.month) })}
            </Button>
            <div className="ml-auto flex min-w-0 flex-1 gap-2 sm:max-w-xs">
              <Select
                value={String(period.month)}
                onValueChange={(v) => {
                  setPeriod({ ...period, month: Number(v) })
                  setOpened(null)
                }}
              >
                <SelectTrigger id={ids.month} aria-label={t('month')} className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {monthName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(period.year)}
                onValueChange={(v) => {
                  setPeriod({ ...period, year: Number(v) })
                  setOpened(null)
                }}
              >
                <SelectTrigger id={ids.year} aria-label={t('year')} className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {formatNumber(y)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isBillNotReady(period) && (
            <FieldMessage tone="warn">
              {t('futureMonth', {
                month: formatPeriod(period.year, period.month),
                next: formatPeriod(billReadyDate(period).getFullYear(), billReadyDate(period).getMonth() + 1),
              })}
            </FieldMessage>
          )}
        </div>

        {/* Options */}
        <Collapsible className="group/more">
          <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ChevronDown className="size-4 transition-transform group-data-[state=open]/more:rotate-180" />
            {t('moreOptions')}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <Field>
              <Label htmlFor={ids.email} className="text-xs text-muted-foreground">
                {t('emailCopy')}
              </Label>
              <Input
                id={ids.email}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="name@example.com"
                value={email}
                aria-invalid={emailError}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={onEnter}
              />
              <FieldMessage tone={emailError ? 'error' : 'hint'}>{emailError ? t('errEmail') : t('emailHint')}</FieldMessage>
            </Field>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center gap-2">
          <Button asChild size="lg" className="h-12 flex-1 text-base shadow-md shadow-primary/20">
            <a
              ref={linkRef}
              href={url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              role={url ? undefined : 'button'}
              tabIndex={0}
              onClick={onLinkClick}
              onKeyDown={(e) => {
                if (!url && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  setTouched(true)
                  inputRef.current?.focus()
                }
              }}
            >
              {t('checkButton')}
              <ExternalLink />
            </a>
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-12" onClick={copyLink} aria-label={t('copyLink')} title={t('copyLink')}>
            <Copy /> <span className="hidden sm:inline">{t('copyLink')}</span>
          </Button>
          {canShare && (
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={share} aria-label={t('share')} title={t('share')}>
              <Share2 /> <span className="hidden sm:inline">{t('share')}</span>
            </Button>
          )}
        </div>

        {opened && (
          <Alert variant="success" role="status" className="animate-in fade-in-0 slide-in-from-top-1">
            <CircleCheck />
            <AlertTitle>{opened.mode === 'popup' ? t('openedTitlePopup') : t('openedTitle')}</AlertTitle>
            <AlertDescription className="text-foreground/80">
              <p>{t('openedBody')}</p>
              <a
                className="inline-flex w-fit items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                href={opened.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openBillFromLink(e, opened.url)}
              >
                {opened.mode === 'popup' ? t('openAgainWindow') : t('openManually')} <ExternalLink className="size-3.5" />
              </a>
            </AlertDescription>
          </Alert>
        )}
      </form>
    </Card>
  )
}
