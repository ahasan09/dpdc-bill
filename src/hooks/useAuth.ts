import { useCallback, useEffect, useState } from 'react'
import { isFirebaseConfigured, loadFirebase } from '../lib/firebase'
import type { MessageKey } from '../lib/i18n'

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export type AuthState =
  | { status: 'unavailable'; user: null }
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: AppUser }

export class AuthError extends Error {
  readonly messageKey: MessageKey
  constructor(messageKey: MessageKey, cause?: unknown) {
    super(messageKey, { cause })
    this.messageKey = messageKey
  }
}

/** Returns null for "the user just closed the popup" so the UI stays quiet. */
function toAuthError(error: unknown): AuthError | null {
  const code = (error as { code?: string })?.code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
  const map: Record<string, MessageKey> = {
    'auth/invalid-credential': 'ae_invalid',
    'auth/wrong-password': 'ae_invalid',
    'auth/user-not-found': 'ae_invalid',
    'auth/invalid-login-credentials': 'ae_invalid',
    'auth/email-already-in-use': 'ae_inUse',
    'auth/weak-password': 'ae_weak',
    'auth/invalid-email': 'ae_email',
    'auth/missing-email': 'ae_email',
    'auth/too-many-requests': 'ae_tooMany',
    'auth/network-request-failed': 'ae_network',
  }
  return new AuthError(map[code] ?? 'ae_generic', error)
}

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    const mapped = toAuthError(error)
    if (mapped) throw mapped
    return undefined
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(
    isFirebaseConfigured ? { status: 'loading', user: null } : { status: 'unavailable', user: null },
  )

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let unsubscribe = () => {}
    let cancelled = false
    loadFirebase()
      .then(({ auth, authMod }) => {
        if (cancelled) return
        // Completes a redirect sign-in (used when popups are blocked).
        authMod.getRedirectResult(auth).catch(() => {})
        unsubscribe = authMod.onAuthStateChanged(auth, (u) => {
          setState(
            u
              ? {
                  status: 'signedIn',
                  user: { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL },
                }
              : { status: 'signedOut', user: null },
          )
        })
      })
      .catch(() => setState({ status: 'unavailable', user: null }))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(
    () =>
      run(async () => {
        const { auth, authMod } = await loadFirebase()
        const provider = new authMod.GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        try {
          await authMod.signInWithPopup(auth, provider)
        } catch (error) {
          if ((error as { code?: string })?.code === 'auth/popup-blocked') {
            await authMod.signInWithRedirect(auth, provider)
            return
          }
          throw error
        }
      }),
    [],
  )

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      run(async () => {
        const { auth, authMod } = await loadFirebase()
        await authMod.signInWithEmailAndPassword(auth, email.trim(), password)
      }),
    [],
  )

  const signUpWithEmail = useCallback(
    (email: string, password: string, name: string) =>
      run(async () => {
        const { auth, authMod } = await loadFirebase()
        const cred = await authMod.createUserWithEmailAndPassword(auth, email.trim(), password)
        if (name.trim()) {
          await authMod.updateProfile(cred.user, { displayName: name.trim() })
          setState({
            status: 'signedIn',
            user: { uid: cred.user.uid, email: cred.user.email, displayName: name.trim(), photoURL: null },
          })
        }
      }),
    [],
  )

  const resetPassword = useCallback(
    (email: string) =>
      run(async () => {
        const { auth, authMod } = await loadFirebase()
        await authMod.sendPasswordResetEmail(auth, email.trim())
      }),
    [],
  )

  const signOut = useCallback(
    () =>
      run(async () => {
        const { auth, authMod } = await loadFirebase()
        await authMod.signOut(auth)
      }),
    [],
  )

  return { state, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut }
}

export type AuthApi = ReturnType<typeof useAuth>
