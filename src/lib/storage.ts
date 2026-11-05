import { loadFirebase } from './firebase'
import { EMPTY_DATA, sanitizeUserData, type UserData } from './userData'

const LOCAL_KEY = 'dpdc-bill-check:data:v1'

/* ---------- On-device (guest) storage ---------- */

export function loadLocal(): UserData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? sanitizeUserData(JSON.parse(raw)) : EMPTY_DATA
  } catch {
    return EMPTY_DATA
  }
}

export function saveLocal(data: UserData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch {
    /* storage blocked (private mode etc.) — the app still works for this visit */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* ignore */
  }
}

export function hasLocalData(data: UserData = loadLocal()): boolean {
  return data.accounts.length > 0 || data.history.length > 0
}

/* ---------- Cloud storage: one small document per user at users/{uid} ---------- */

export async function subscribeCloud(
  uid: string,
  onData: (data: UserData) => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const { db, fsMod } = await loadFirebase()
  return fsMod.onSnapshot(
    fsMod.doc(db, 'users', uid),
    (snap) => onData(snap.exists() ? sanitizeUserData(snap.data()) : EMPTY_DATA),
    onError,
  )
}

export async function saveCloud(uid: string, data: UserData): Promise<void> {
  const { db, fsMod } = await loadFirebase()
  await fsMod.setDoc(fsMod.doc(db, 'users', uid), {
    ...data,
    updatedAt: fsMod.serverTimestamp(),
  })
}

export async function deleteCloud(uid: string): Promise<void> {
  const { db, fsMod } = await loadFirebase()
  await fsMod.deleteDoc(fsMod.doc(db, 'users', uid))
}
