import type { MessageKey } from './i18n'
import type { Account } from './userData'

type T = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Nickname, or "Account 5678" when the user didn't give one. */
export function accountLabel(account: Pick<Account, 'nickname' | 'customerNo'>, t: T): string {
  return account.nickname || t('untitled', { no: account.customerNo.slice(-4) })
}
