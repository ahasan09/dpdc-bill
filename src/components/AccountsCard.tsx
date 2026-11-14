import { ExternalLink, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import {
  CUSTOMER_NO_MAX,
  CUSTOMER_NO_MIN,
  buildBillUrl,
  latestBillPeriod,
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
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Checkbox } from './ui/checkbox'
import { DialogFooter } from './ui/dialog'
import { Field, FieldMessage } from './ui/field'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Update = (fn: (d: UserData) => UserData) => void

export function AccountsCard({ data, update }: { data: UserData; update: Update }) {
  const { t, formatPeriod } = useI18n()
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
    <Card aria-labelledby="accounts-title">
      <CardHeader>
        <CardTitle id="accounts-title">{t('accountsTitle')}</CardTitle>
        <Button variant="secondary" size="xs" onClick={() => setEditing('new')}>
          <Plus /> {t('addNumber')}
        </Button>
      </CardHeader>

      {data.accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t('noAccounts')}</p>
      ) : (
        <ul className="-mx-2 grid grid-cols-1">
          {data.accounts.map((a) => {
            const isDefault = a.id === data.defaultAccountId
            const now = latestBillPeriod() // newest e-bill that should exist
            const url = buildBillUrl({ billType: 'current', ...now, customerNo: a.customerNo, email: data.email })
            return (
              <li key={a.id} className="group flex items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-accent/60">
                {isDefault ? (
                  <span className="grid size-8 shrink-0 place-items-center text-gold" title={t('default')}>
                    <Star className="size-4 fill-current" />
                    <span className="sr-only">{t('default')}</span>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground/60 hover:text-gold"
                    title={t('makeDefault')}
                    aria-label={`${t('makeDefault')}: ${accountLabel(a, t)}`}
                    onClick={() => update((d) => setDefaultAccount(d, a.id))}
                  >
                    <Star />
                  </Button>
                )}
                <p className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="min-w-0 truncate text-sm font-medium" title={accountLabel(a, t)}>
                    {accountLabel(a, t)}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{a.customerNo}</span>
                </p>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    title={t('edit')}
                    aria-label={`${t('edit')}: ${accountLabel(a, t)}`}
                    onClick={() => setEditing(a)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title={t('delete')}
                    aria-label={`${t('delete')}: ${accountLabel(a, t)}`}
                    onClick={() => remove(a)}
                  >
                    <Trash2 />
                  </Button>
                  <Button asChild variant="secondary" size="xs" className="ml-1">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${t('bt_current')} · ${formatPeriod(now.year, now.month)}`}
                      onClick={(e) => {
                        openBillFromLink(e, url)
                        update((d) =>
                          recordCheck(d, { customerNo: a.customerNo, nickname: a.nickname, billType: 'current', ...now }),
                        )
                      }}
                    >
                      {t('check')} <ExternalLink />
                    </a>
                  </Button>
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
    </Card>
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
      <form className="grid grid-cols-1 gap-4" onSubmit={submit} noValidate>
        <Field>
          <Label htmlFor={ids.cno}>{t('customerNo')}</Label>
          <Input
            id={ids.cno}
            className="h-11 font-mono text-base tracking-wide"
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
          <FieldMessage id={`${ids.cno}-hint`} tone={message ? 'error' : 'hint'}>
            {message ?? t('customerNoHint')}
          </FieldMessage>
        </Field>
        <Field>
          <Label htmlFor={ids.nick}>{t('nickname')}</Label>
          <Input
            id={ids.nick}
            placeholder={t('nicknamePlaceholder')}
            value={nickname}
            maxLength={40}
            autoFocus={!!editing}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>
        <Label className="font-normal">
          <Checkbox checked={makeDefault} onCheckedChange={(c) => setMakeDefault(c === true)} />
          {t('makeDefault')}
        </Label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit">{t('save')}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
