import { useId, useState, type FormEvent } from 'react'
import {
  CUSTOMER_NO_MAX,
  CUSTOMER_NO_MIN,
  buildBillUrl,
  currentPeriod,
  shiftPeriod,
  normalizeCustomerNo,
  validateCustomerNo,
} from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import {
  addAccount,
  findAccountByNo,
  recordCheck,
  removeAccount,
  setDefaultAccount,
  updateAccount,
  type Account,
  type UserData,
} from '../lib/userData'
import { accountLabel } from '../lib/labels'
import { openBillFromLink } from '../lib/openBill'
import { Dialog } from './Dialog'
import { Icon } from './Icon'
import { useToast } from './Toast'

type Update = (fn: (d: UserData) => UserData) => void

export function AccountsCard({ data, update }: { data: UserData; update: Update }) {
  const { t } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  function remove(account: Account) {
    const index = data.accounts.findIndex((a) => a.id === account.id)
    const wasDefault = data.defaultAccountId === account.id
    update((d) => removeAccount(d, account.id))
    toast(t('removed', { name: accountLabel(account, t) }), {
      action: {
        label: t('undo'),
        onClick: () =>
          update((d) => {
            if (d.accounts.some((a) => a.id === account.id || a.customerNo === account.customerNo)) return d
            const accounts = [...d.accounts]
            accounts.splice(Math.min(index, accounts.length), 0, account)
            return { ...d, accounts, defaultAccountId: wasDefault || !d.defaultAccountId ? account.id : d.defaultAccountId }
          }),
      },
    })
  }

  return (
    <section className="card" aria-labelledby="accounts-title">
      <div className="card__head">
        <h2 id="accounts-title" className="card__title">
          {t('accountsTitle')}
        </h2>
        <button type="button" className="btn btn--soft btn--sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> {t('addNumber')}
        </button>
      </div>

      {data.accounts.length === 0 ? (
        <p className="empty">{t('noAccounts')}</p>
      ) : (
        <ul className="list list--compact">
          {data.accounts.map((a) => {
            const isDefault = a.id === data.defaultAccountId
            const now = shiftPeriod(currentPeriod(), -1) // last month's e-bill
            const url = buildBillUrl({ billType: 'current', ...now, customerNo: a.customerNo, email: data.email })
            return (
              <li key={a.id} className="list__item">
                {isDefault ? (
                  <span className="acct-star acct-star--on" title={t('default')}>
                    <Icon name="star" size={16} />
                    <span className="sr-only">{t('default')}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-btn acct-star"
                    title={t('makeDefault')}
                    aria-label={`${t('makeDefault')}: ${accountLabel(a, t)}`}
                    onClick={() => update((d) => setDefaultAccount(d, a.id))}
                  >
                    <Icon name="star" size={16} />
                  </button>
                )}
                <p className="list__main list__inline">
                  <span className="list__title" title={accountLabel(a, t)}>
                    {accountLabel(a, t)}
                  </span>
                  <span className="list__meta mono">{a.customerNo}</span>
                </p>
                <div className="list__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('edit')}
                    aria-label={`${t('edit')}: ${accountLabel(a, t)}`}
                    onClick={() => setEditing(a)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    title={t('delete')}
                    aria-label={`${t('delete')}: ${accountLabel(a, t)}`}
                    onClick={() => remove(a)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                  <a
                    className="btn btn--soft btn--xs"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${t('bt_current')} · ${t('lastMonth')}`}
                    onClick={(e) => {
                      openBillFromLink(e, url)
                      update((d) =>
                        recordCheck(d, { customerNo: a.customerNo, nickname: a.nickname, billType: 'current', ...now }),
                      )
                    }}
                  >
                    {t('check')} <Icon name="external" size={13} />
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AccountDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        account={editing}
        data={data}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (editing === 'new') {
            update((d) => {
              const next = addAccount(d, input)
              if (input.makeDefault) {
                const saved = findAccountByNo(next, input.customerNo)
                return saved ? setDefaultAccount(next, saved.id) : next
              }
              return next
            })
          } else if (editing) {
            update((d) => {
              const next = updateAccount(d, editing.id, input)
              return input.makeDefault ? setDefaultAccount(next, editing.id) : next
            })
          }
          toast(t('numberSaved', { name: input.nickname || t('untitled', { no: input.customerNo.slice(-4) }) }))
          setEditing(null)
        }}
      />
    </section>
  )
}

function AccountDialog({
  account,
  data,
  onClose,
  onSave,
}: {
  account: Account | 'new' | null
  data: UserData
  onClose: () => void
  onSave: (input: { customerNo: string; nickname: string; makeDefault: boolean }) => void
}) {
  const { t } = useI18n()
  const ids = { cno: useId(), nick: useId() }
  const editing = account && account !== 'new' ? account : null
  const [customerNo, setCustomerNo] = useState(editing?.customerNo ?? '')
  const [nickname, setNickname] = useState(editing?.nickname ?? '')
  const [makeDefault, setMakeDefault] = useState(editing ? editing.id === data.defaultAccountId : data.accounts.length === 0)
  const [touched, setTouched] = useState(false)

  const error = validateCustomerNo(customerNo)
  const duplicate = !error ? findAccountByNo(data, customerNo) : undefined
  const isDuplicate = duplicate && duplicate.id !== editing?.id

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error || isDuplicate) return
    onSave({ customerNo: normalizeCustomerNo(customerNo), nickname: nickname.trim(), makeDefault })
  }

  const message = touched && error
    ? t(error === 'empty' ? 'errEmpty' : error === 'notDigits' ? 'errNotDigits' : 'errLength', {
        min: CUSTOMER_NO_MIN,
        max: CUSTOMER_NO_MAX,
      })
    : isDuplicate
      ? t('duplicate', { name: accountLabel(duplicate, t) })
      : null

  return (
    <Dialog open={account !== null} onClose={onClose} title={editing ? t('editTitle') : t('addTitle')}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.cno} className="label">
            {t('customerNo')}
          </label>
          <input
            id={ids.cno}
            className={`input input--lg mono ${message ? 'is-invalid' : ''}`}
            inputMode="numeric"
            autoComplete="off"
            autoFocus={!editing}
            placeholder={t('customerNoPlaceholder')}
            value={customerNo}
            aria-invalid={!!message}
            aria-describedby={`${ids.cno}-hint`}
            onChange={(e) => setCustomerNo(e.target.value)}
            onBlur={() => customerNo && setTouched(true)}
          />
          <p id={`${ids.cno}-hint`} className={message ? 'error' : 'hint'}>
            {message ?? t('customerNoHint')}
          </p>
        </div>
        <div className="field">
          <label htmlFor={ids.nick} className="label">
            {t('nickname')}
          </label>
          <input
            id={ids.nick}
            className="input"
            placeholder={t('nicknamePlaceholder')}
            value={nickname}
            maxLength={40}
            autoFocus={!!editing}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
          <span>{t('makeDefault')}</span>
        </label>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn--primary">
            {t('save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
