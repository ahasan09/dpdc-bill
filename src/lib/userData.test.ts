import { describe, expect, it } from 'vitest'
import {
  BILL_LIMIT,
  EMPTY_DATA,
  findBill,
  removeBill,
  upsertBill,
  HISTORY_LIMIT,
  addAccount,
  defaultAccount,
  mergeUserData,
  recordCheck,
  removeAccount,
  sanitizeUserData,
  setDefaultAccount,
} from './userData'

const check = (customerNo: string, month = 1) => ({
  customerNo,
  nickname: '',
  billType: 'current' as const,
  year: 2026,
  month,
})

describe('accounts', () => {
  it('makes the first account the default and dedupes by number', () => {
    let data = addAccount(EMPTY_DATA, { customerNo: '11111111', nickname: 'Home' })
    data = addAccount(data, { customerNo: '22222222', nickname: 'Shop' })
    data = addAccount(data, { customerNo: '1111 1111', nickname: 'Flat' })
    expect(data.accounts).toHaveLength(2)
    expect(data.accounts[0].nickname).toBe('Flat')
    expect(defaultAccount(data)?.customerNo).toBe('11111111')
  })

  it('moves the default when the default account is removed', () => {
    let data = addAccount(EMPTY_DATA, { customerNo: '11111111', nickname: 'A' })
    data = addAccount(data, { customerNo: '22222222', nickname: 'B' })
    data = setDefaultAccount(data, data.accounts[1].id)
    data = removeAccount(data, data.accounts[1].id)
    expect(data.defaultAccountId).toBe(data.accounts[0].id)
    data = removeAccount(data, data.accounts[0].id)
    expect(data.defaultAccountId).toBeNull()
  })
})

describe('history', () => {
  it('moves repeated checks to the top instead of duplicating them', () => {
    let data = recordCheck(EMPTY_DATA, check('11111111', 1), 1)
    data = recordCheck(data, check('11111111', 2), 2)
    data = recordCheck(data, check('11111111', 1), 3)
    expect(data.history.map((h) => h.month)).toEqual([1, 2])
  })

  it('keeps at most the limit', () => {
    let data = EMPTY_DATA
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) data = recordCheck(data, check(`1000000${i}`), i)
    expect(data.history).toHaveLength(HISTORY_LIMIT)
  })
})

describe('mergeUserData', () => {
  it('adds device numbers to the cloud copy without overwriting cloud ones', () => {
    const cloud = addAccount(EMPTY_DATA, { customerNo: '11111111', nickname: 'Cloud home' })
    let local = addAccount(EMPTY_DATA, { customerNo: '11111111', nickname: 'Device home' })
    local = addAccount(local, { customerNo: '33333333', nickname: 'Office' })
    local = recordCheck(local, check('33333333'), 5)
    const { data, added } = mergeUserData(cloud, local)
    expect(added).toBe(1)
    expect(data.accounts.map((a) => a.nickname)).toEqual(['Cloud home', 'Office'])
    expect(data.defaultAccountId).toBe(cloud.defaultAccountId)
    expect(data.history).toHaveLength(1)
  })
})

describe('sanitizeUserData', () => {
  it('returns empty data for junk', () => {
    expect(sanitizeUserData('nope')).toEqual(EMPTY_DATA)
    expect(sanitizeUserData({ accounts: [{ customerNo: 'abc' }] }).accounts).toEqual([])
  })
  it('repairs a missing default', () => {
    const data = sanitizeUserData({
      accounts: [{ id: 'x', customerNo: '12345678', nickname: 'Home', createdAt: 1 }],
      defaultAccountId: 'missing',
    })
    expect(data.defaultAccountId).toBe('x')
  })
})

const bill = (customerNo: string, year: number, month: number, amount: number | null = 100) => ({
  customerNo,
  year,
  month,
  amount,
  lateAmount: null,
  units: 50,
  presentReading: null,
  previousReading: null,
  dueDate: null,
  fileName: 'test.pdf',
})

describe('bills', () => {
  it('keeps one summary per number and month, newest month first', () => {
    let data = upsertBill(EMPTY_DATA, bill('11111111', 2026, 8, 100), 1)
    data = upsertBill(data, bill('11111111', 2026, 9, 200), 2)
    const firstId = findBill(data, '11111111', 2026, 9)!.id
    data = upsertBill(data, bill('11111111', 2026, 9, 250), 3)
    expect(data.bills.map((b) => [b.month, b.amount])).toEqual([
      [9, 250],
      [8, 100],
    ])
    expect(findBill(data, '11111111', 2026, 9)!.id).toBe(firstId)
  })

  it('removes a summary', () => {
    let data = upsertBill(EMPTY_DATA, bill('11111111', 2026, 8))
    data = removeBill(data, data.bills[0].id)
    expect(data.bills).toEqual([])
  })

  it('stops adding new months at the limit but still allows replacing', () => {
    let data = EMPTY_DATA
    for (let i = 0; i < BILL_LIMIT + 3; i++) data = upsertBill(data, bill(String(10000000 + i), 2026, 1))
    expect(data.bills).toHaveLength(BILL_LIMIT)
    data = upsertBill(data, bill('10000000', 2026, 1, 999))
    expect(findBill(data, '10000000', 2026, 1)!.amount).toBe(999)
  })

  it('merges device bills into the cloud copy without overwriting cloud months', () => {
    const cloud = upsertBill(EMPTY_DATA, bill('11111111', 2026, 9, 200))
    let local = upsertBill(EMPTY_DATA, bill('11111111', 2026, 9, 999))
    local = upsertBill(local, bill('11111111', 2026, 8, 150))
    const { data } = mergeUserData(cloud, local)
    expect(data.bills.map((b) => [b.month, b.amount])).toEqual([
      [9, 200],
      [8, 150],
    ])
  })

  it('reads older saved data that has no bills', () => {
    expect(sanitizeUserData({ accounts: [] }).bills).toEqual([])
  })
})
