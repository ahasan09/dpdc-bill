/**
 * Firebase is optional. Without the VITE_FIREBASE_* variables the app runs in
 * on-device mode (numbers saved in this browser only) and hides sign-in.
 * The SDK is loaded lazily so the first paint never waits for it.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
)

export type AuthModule = typeof import('firebase/auth')
export type FirestoreModule = typeof import('firebase/firestore')

export interface FirebaseServices {
  auth: import('firebase/auth').Auth
  db: import('firebase/firestore').Firestore
  authMod: AuthModule
  fsMod: FirestoreModule
}

let services: Promise<FirebaseServices> | null = null

export function loadFirebase(): Promise<FirebaseServices> {
  if (!isFirebaseConfigured) return Promise.reject(new Error('Firebase is not configured'))
  services ??= (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ])
    const app = appMod.initializeApp(config)
    const auth = authMod.getAuth(app)
    let db: import('firebase/firestore').Firestore
    try {
      // Offline support + sync between open tabs.
      db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({
          tabManager: fsMod.persistentMultipleTabManager(),
        }),
      })
    } catch {
      db = fsMod.getFirestore(app)
    }
    return { auth, db, authMod, fsMod }
  })()
  return services
}
