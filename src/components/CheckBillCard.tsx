import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  BILL_TYPES,
  CUSTOMER_NO_MAX,
  CUSTOMER_NO_MIN,
  availableYears,
  buildBillUrl,
  currentPeriod,
  isFuturePeriod,
  isValidEmail,
  normalizeCustomerNo,
  shiftPeriod,
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
import { Icon } from './Icon'
import { useToast } from './Toast'

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
  const { t, monthName, formatNumber } = useI18n()
  const toast = useToast()
  const ids = { cno: useId(), nick: useId(), email: useId(), month: useId(), year: useId(), type: useId() }

  const [selected, setSelected] = useState<string>(() => defaultAccount(data)?.id ?? NEW)
  const [typed, setTyped] = useState('')
  const [nickname, setNickname] = useState('')
  const [saveNumber, setSaveNumber] = useState(true)
  const [billType, setBillType] = useState<BillType>('current')
  const [period, setPeriod] = useState<Period>(() => shiftPeriod(currentPeriod(), -1))
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

  // Bills cover the previous month, so "Last month" is the default and the one quick pick.
  const lastMonth = shiftPeriod(currentPeriod(), -1)
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

  return (
    <section className="card card--primary" aria-labelledby="check-title" id="check">
      <div className="card__head">
        <h2 id="check-title" className="card__title">
          <span className="title-icon" aria-hidden="true">
            <Icon name="bolt" />
          </span>
          {t('checkTitle')}
        </h2>
      </div>

      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        {/* Customer number */}
        <fieldset className="field">
          <legend className="label">{data.accounts.length > 0 ? t('savedAccounts') : t('customerNo')}</legend>

          {data.accounts.length > 0 && (
            <div className="chips" role="radiogroup" aria-label={t('savedAccounts')}>
              {data.accounts.map((a) => (
                <label key={a.id} className={`chip chip--account ${selected === a.id ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name="account"
                    value={a.id}
                    checked={selected === a.id}
                    onChange={() => {
                      setSelected(a.id)
                      setOpened(null)
                    }}
                  />
                  <span className="chip__name">
                    {a.id === data.defaultAccountId && <Icon name="star" size={13} className="chip__star" />}
                    {accountLabel(a, t)}
                  </span>
                  <span className="chip__meta mono">{a.customerNo}</span>
                </label>
              ))}
              <label className={`chip chip--account chip--new ${selected === NEW ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="account"
                  value={NEW}
                  checked={selected === NEW}
                  onChange={() => {
                    setSelected(NEW)
                    setOpened(null)
                    setTimeout(() => inputRef.current?.focus(), 0)
                  }}
                />
                <span className="chip__name">
                  <Icon name="plus" size={14} /> {t('otherNumber')}
                </span>
              </label>
            </div>
          )}

          {selected === NEW && (
            <div className="stack-sm">
              {data.accounts.length > 0 && (
                <label htmlFor={ids.cno} className="label label--sub">
                  {t('customerNo')}
                </label>
              )}
              <input
                ref={inputRef}
                id={ids.cno}
                className={`input input--lg mono ${touched && cnoError ? 'is-invalid' : ''}`}
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
              <p id={`${ids.cno}-hint`} className={touched && cnoError ? 'error' : 'hint'}>
                {touched && cnoError
                  ? t(errorKey[cnoError], { min: CUSTOMER_NO_MIN, max: CUSTOMER_NO_MAX })
                  : existing
                    ? t('duplicate', { name: accountLabel(existing, t) })
                    : t('customerNoHint')}
              </p>

              {!existing && (
                <>
                  <label className="checkbox">
                    <input type="checkbox" checked={saveNumber} onChange={(e) => setSaveNumber(e.target.checked)} />
                    <span>{t('saveThisNumber')}</span>
                  </label>
                  {saveNumber && (
                    <div className="field">
                      <label htmlFor={ids.nick} className="label label--sub">
                        {t('nickname')}
                      </label>
                      <input
                        id={ids.nick}
                        className="input"
                        placeholder={t('nicknamePlaceholder')}
                        value={nickname}
                        maxLength={40}
                        autoComplete="off"
                        onChange={(e) => setNickname(e.target.value)}
                        onKeyDown={onEnter}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </fieldset>

        {/* Bill type */}
        <fieldset className="field">
          <legend className="label">{t('billType')}</legend>
          <div className="segmented" role="radiogroup" aria-label={t('billType')}>
            {BILL_TYPES.map((type) => (
              <label key={type} className={`segmented__item ${billType === type ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="billType"
                  value={type}
                  checked={billType === type}
                  onChange={() => {
                    setBillType(type)
                    setOpened(null)
                  }}
                />
                {t(`bt_${type}` as MessageKey)}
              </label>
            ))}
          </div>
          <p className="hint">{t(`bt_${billType}_desc` as MessageKey)}</p>
        </fieldset>

        {/* Period */}
        <fieldset className="field">
          <legend className="label">{t('billMonth')}</legend>
          <div className="period">
            {[
              { p: lastMonth, label: t('lastMonth') },
            ].map(({ p, label }) => (
              <button
                key={label}
                type="button"
                className={`chip ${samePeriod(period, p) ? 'is-on' : ''}`}
                aria-pressed={samePeriod(period, p)}
                onClick={() => {
                  setPeriod(p)
                  setOpened(null)
                }}
              >
                {label}
              </button>
            ))}
            <div className="period__selects">
              <label htmlFor={ids.month} className="sr-only">
                {t('month')}
              </label>
              <select
                id={ids.month}
                className="input"
                value={period.month}
                onChange={(e) => {
                  setPeriod({ ...period, month: Number(e.target.value) })
                  setOpened(null)
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
              <label htmlFor={ids.year} className="sr-only">
                {t('year')}
              </label>
              <select
                id={ids.year}
                className="input"
                value={period.year}
                onChange={(e) => {
                  setPeriod({ ...period, year: Number(e.target.value) })
                  setOpened(null)
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {formatNumber(y)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {isFuturePeriod(period) && <p className="hint hint--warn">{t('futureMonth')}</p>}
        </fieldset>

        {/* Options */}
        <details className="details">
          <summary>{t('moreOptions')}</summary>
          <div className="field">
            <label htmlFor={ids.email} className="label label--sub">
              {t('emailCopy')}
            </label>
            <input
              id={ids.email}
              type="email"
              className={`input ${emailError ? 'is-invalid' : ''}`}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              aria-invalid={emailError}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={onEnter}
            />
            <p className={emailError ? 'error' : 'hint'}>{emailError ? t('errEmail') : t('emailHint')}</p>
          </div>
        </details>

        <div className="actions">
          <a
            ref={linkRef}
            className="btn btn--primary btn--lg"
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
            <Icon name="external" />
          </a>
          <div className="actions__secondary">
            <button type="button" className="btn btn--ghost" onClick={copyLink}>
              <Icon name="copy" /> {t('copyLink')}
            </button>
            {canShare && (
              <button type="button" className="btn btn--ghost" onClick={share}>
                <Icon name="share" /> {t('share')}
              </button>
            )}
          </div>
        </div>

        {opened && (
          <div className="notice" role="status">
            <Icon name="check" className="notice__icon" />
            <div>
              <p className="notice__title">{opened.mode === 'popup' ? t('openedTitlePopup') : t('openedTitle')}</p>
              <p>{t('openedBody')}</p>
              <a
                className="link"
                href={opened.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openBillFromLink(e, opened.url)}
              >
                {opened.mode === 'popup' ? t('openAgainWindow') : t('openManually')} <Icon name="external" size={14} />
              </a>
            </div>
          </div>
        )}
      </form>
    </section>
  )
}
