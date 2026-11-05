import { BILL_TYPES, normalizeCustomerNo, type BillType } from './dpdc'

export interface Account {
  id: string
  customerNo: string
  nickname: string
  createdAt: number
}

export interface HistoryEntry {
  id: string
  customerNo: string
  nickname: string
  billType: BillType
  year: number
  month: number
  checkedAt: number
}

/** A bill's key numbers, read from an uploaded PDF (or typed in) and confirmed by the user. */
export interface BillSummary {
  id: string
  customerNo: string
  year: number
  month: number
  /** Total payable, taka */
  amount: number | null
  /** kWh */
  units: number | null
  /** yyyy-mm-dd */
  dueDate: string | null
  fileName: string
  addedAt: number
}

export interface UserData {
  version: 1
  accounts: Account[]
  defaultAccountId: string | null
  history: HistoryEntry[]
  /** One summary per customer number and month. */
  bills: BillSummary[]
  /** Optional address the official site e-mails a bill copy to. */
  email: string
}

export const ACCOUNT_LIMIT = 50
export const HISTORY_LIMIT = 20
/** 25 numbers × 12 months; a summary is ~200 bytes, far below Firestore's 1 MB per document. */
export const BILL_LIMIT = 300

export const EMPTY_DATA: UserData = {
  version: 1,
  accounts: [],
  defaultAccountId: null,
  history: [],
  bills: [],
  email: '',
}

export function newId(): string {
  return crypto.randomUUID()
}

export function findAccountByNo(data: UserData, customerNo: string): Account | undefined {
  const no = normalizeCustomerNo(customerNo)
  return data.accounts.find((a) => a.customerNo === no)
}

export function defaultAccount(data: UserData): Account | undefined {
  return data.accounts.find((a) => a.id === data.defaultAccountId) ?? data.accounts[0]
}

/** Adds an account, or renames it if the number is already saved. The first account becomes the default. */
export function addAccount(
  data: UserData,
  input: { customerNo: string; nickname: string },
  now: number = Date.now(),
): UserData {
  const customerNo = normalizeCustomerNo(input.customerNo)
  const nickname = input.nickname.trim()
  const existing = findAccountByNo(data, customerNo)
  if (existing) {
    return nickname ? updateAccount(data, existing.id, { nickname }) : data
  }
  if (data.accounts.length >= ACCOUNT_LIMIT) return data
  const account: Account = { id: newId(), customerNo, nickname, createdAt: now }
  return {
    ...data,
    accounts: [...data.accounts, account],
    defaultAccountId: data.defaultAccountId ?? account.id,
  }
}

export function updateAccount(
  data: UserData,
  id: string,
  patch: Partial<Pick<Account, 'nickname' | 'customerNo'>>,
): UserData {
  const clean: Partial<Account> = {}
  if (patch.nickname !== undefined) clean.nickname = patch.nickname.trim()
  if (patch.customerNo !== undefined) clean.customerNo = normalizeCustomerNo(patch.customerNo)
  return {
    ...data,
    accounts: data.accounts.map((a) => (a.id === id ? { ...a, ...clean } : a)),
  }
}

export function removeAccount(data: UserData, id: string): UserData {
  const accounts = data.accounts.filter((a) => a.id !== id)
  const defaultAccountId =
    data.defaultAccountId === id ? (accounts[0]?.id ?? null) : data.defaultAccountId
  return { ...data, accounts, defaultAccountId }
}

export function setDefaultAccount(data: UserData, id: string): UserData {
  return data.accounts.some((a) => a.id === id) ? { ...data, defaultAccountId: id } : data
}

const historyKey = (h: Pick<HistoryEntry, 'customerNo' | 'billType' | 'year' | 'month'>) =>
  `${h.customerNo}|${h.billType}|${h.year}|${h.month}`

/** Puts a check at the top of history; repeating the same check moves it up instead of duplicating it. */
export function recordCheck(
  data: UserData,
  entry: Omit<HistoryEntry, 'id' | 'checkedAt'>,
  now: number = Date.now(),
): UserData {
  const item: HistoryEntry = {
    ...entry,
    customerNo: normalizeCustomerNo(entry.customerNo),
    id: newId(),
    checkedAt: now,
  }
  const key = historyKey(item)
  const rest = data.history.filter((h) => historyKey(h) !== key)
  return { ...data, history: [item, ...rest].slice(0, HISTORY_LIMIT) }
}

export function clearHistory(data: UserData): UserData {
  return { ...data, history: [] }
}

const billKey = (b: Pick<BillSummary, 'customerNo' | 'year' | 'month'>) => `${b.customerNo}|${b.year}|${b.month}`

export function findBill(data: UserData, customerNo: string, year: number, month: number): BillSummary | undefined {
  const key = billKey({ customerNo: normalizeCustomerNo(customerNo), year, month })
  return data.bills.find((b) => billKey(b) === key)
}

/** Saves a summary; a summary for the same number and month is replaced. Newest months first. */
export function upsertBill(
  data: UserData,
  input: Omit<BillSummary, 'id' | 'addedAt'>,
  now: number = Date.now(),
): UserData {
  const bill: BillSummary = { ...input, customerNo: normalizeCustomerNo(input.customerNo), id: newId(), addedAt: now }
  const existing = findBill(data, bill.customerNo, bill.year, bill.month)
  if (existing) bill.id = existing.id
  const rest = data.bills.filter((b) => billKey(b) !== billKey(bill))
  if (!existing && rest.length >= BILL_LIMIT) return data
  return { ...data, bills: sortBills([...rest, bill]) }
}

export function removeBill(data: UserData, id: string): UserData {
  return { ...data, bills: data.bills.filter((b) => b.id !== id) }
}

export function billsFor(data: UserData, customerNo: string): BillSummary[] {
  return data.bills.filter((b) => b.customerNo === customerNo)
}

function sortBills(bills: BillSummary[]): BillSummary[] {
  return [...bills].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month) || a.customerNo.localeCompare(b.customerNo))
}

export function setEmail(data: UserData, email: string): UserData {
  return { ...data, email: email.trim() }
}

/**
 * Merges guest (on-device) data into the cloud copy when someone signs in.
 * The cloud copy wins on conflicts; new numbers from the device are appended.
 */
export function mergeUserData(cloud: UserData, local: UserData): { data: UserData; added: number } {
  let data = cloud
  let added = 0
  for (const account of local.accounts) {
    if (!findAccountByNo(data, account.customerNo)) {
      const before = data.accounts.length
      data = addAccount(data, account, account.createdAt)
      if (data.accounts.length > before) added++
    }
  }
  const seen = new Set<string>()
  const history = [...data.history, ...local.history]
    .sort((a, b) => b.checkedAt - a.checkedAt)
    .filter((h) => {
      const key = historyKey(h)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, HISTORY_LIMIT)
  const cloudKeys = new Set(data.bills.map(billKey))
  const bills = sortBills([...data.bills, ...local.bills.filter((b) => !cloudKeys.has(billKey(b)))]).slice(0, BILL_LIMIT)
  return { data: { ...data, history, bills, email: data.email || local.email }, added }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Defensive parse for anything read from storage or the network. */
export function sanitizeUserData(raw: unknown): UserData {
  if (!isObj(raw)) return EMPTY_DATA
  const accounts: Account[] = (Array.isArray(raw.accounts) ? raw.accounts : [])
    .filter(isObj)
    .map((a) => ({
      id: str(a.id) || newId(),
      customerNo: normalizeCustomerNo(str(a.customerNo)),
      nickname: str(a.nickname),
      createdAt: num(a.createdAt),
    }))
    .filter((a) => /^\d+$/.test(a.customerNo))
    .slice(0, ACCOUNT_LIMIT)
  const history: HistoryEntry[] = (Array.isArray(raw.history) ? raw.history : [])
    .filter(isObj)
    .map((h) => ({
      id: str(h.id) || newId(),
      customerNo: normalizeCustomerNo(str(h.customerNo)),
      nickname: str(h.nickname),
      billType: (BILL_TYPES as readonly string[]).includes(str(h.billType))
        ? (h.billType as BillType)
        : 'current',
      year: num(h.year),
      month: num(h.month),
      checkedAt: num(h.checkedAt),
    }))
    .filter((h) => /^\d+$/.test(h.customerNo) && h.month >= 1 && h.month <= 12 && h.year > 0)
    .slice(0, HISTORY_LIMIT)
  const bills: BillSummary[] = sortBills(
    (Array.isArray(raw.bills) ? raw.bills : [])
      .filter(isObj)
      .map((b) => ({
        id: str(b.id) || newId(),
        customerNo: normalizeCustomerNo(str(b.customerNo)),
        year: num(b.year),
        month: num(b.month),
        amount: numOrNull(b.amount),
        units: numOrNull(b.units),
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str(b.dueDate)) ? str(b.dueDate) : null,
        fileName: str(b.fileName).slice(0, 200),
        addedAt: num(b.addedAt),
      }))
      .filter((b) => /^\d+$/.test(b.customerNo) && b.month >= 1 && b.month <= 12 && b.year > 0),
  ).slice(0, BILL_LIMIT)
  const defaultId = str(raw.defaultAccountId)
  return {
    version: 1,
    accounts,
    defaultAccountId: accounts.some((a) => a.id === defaultId)
      ? defaultId
      : (accounts[0]?.id ?? null),
    history,
    bills,
    email: str(raw.email),
  }
}
