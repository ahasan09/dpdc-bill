import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clearLocal, hasLocalData, loadLocal, saveCloud, saveLocal, subscribeCloud } from '../lib/storage'
import { mergeUserData, type UserData } from '../lib/userData'
import type { AuthState } from './useAuth'

interface Options {
  onImported?: (count: number) => void
  onSyncError?: (error: unknown) => void
}

/**
 * Guests: data lives in localStorage.
 * Signed in: data lives in Firestore (live-synced across devices). On the first
 * sign-in on a device, anything saved as a guest is merged into the account and
 * removed from the device, so a shared computer doesn't keep it after sign-out.
 */
export function useUserData(auth: AuthState, { onImported, onSyncError }: Options = {}) {
  const [data, setData] = useState<UserData>(loadLocal)
  const [ready, setReady] = useState(auth.status !== 'loading')
  const dataRef = useRef(data)
  const callbacks = useRef({ onImported, onSyncError })
  useLayoutEffect(() => {
    callbacks.current = { onImported, onSyncError }
  })

  const uid = auth.status === 'signedIn' ? auth.user.uid : null
  const loading = auth.status === 'loading'

  const apply = (next: UserData) => {
    dataRef.current = next
    setData(next)
  }

  useEffect(() => {
    if (loading) return
    if (!uid) {
      apply(loadLocal())
      setReady(true)
      return
    }
    setReady(false)
    let cancelled = false
    let unsubscribe = () => {}
    let first = true
    subscribeCloud(
      uid,
      (cloud) => {
        if (cancelled) return
        if (first) {
          first = false
          const local = loadLocal()
          if (hasLocalData(local)) {
            const { data: merged, added } = mergeUserData(cloud, local)
            apply(merged)
            setReady(true)
            saveCloud(uid, merged)
              .then(() => {
                clearLocal()
                if (added > 0) callbacks.current.onImported?.(added)
              })
              .catch((e) => callbacks.current.onSyncError?.(e))
            return
          }
        }
        apply(cloud)
        setReady(true)
      },
      (e) => {
        callbacks.current.onSyncError?.(e)
        setReady(true)
      },
    )
      .then((u) => (cancelled ? u() : (unsubscribe = u)))
      .catch((e) => {
        callbacks.current.onSyncError?.(e)
        setReady(true)
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [uid, loading])

  const update = useCallback(
    (fn: (current: UserData) => UserData) => {
      const next = fn(dataRef.current)
      if (next === dataRef.current) return
      apply(next)
      if (uid) saveCloud(uid, next).catch((e) => callbacks.current.onSyncError?.(e))
      else saveLocal(next)
    },
    [uid],
  )

  return { data, ready, update }
}
