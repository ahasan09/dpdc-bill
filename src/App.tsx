import { ChartColumn, Cloud, Coins, ExternalLink, ShieldCheck, Smartphone, WifiOff, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AccountsCard } from './components/AccountsCard'
import { AuthDialog } from './components/AuthDialog'
import { BillHistoryCard } from './components/BillHistoryCard'
import { CheckBillCard } from './components/CheckBillCard'
import { Header } from './components/Header'
import { GoldCard } from './components/GoldCard'
import { HistoryCard } from './components/HistoryCard'
import { ReminderCard } from './components/ReminderCard'
import { useToast } from './components/Toast'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Skeleton } from './components/ui/skeleton'
import { Toaster } from './components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { useAuth } from './hooks/useAuth'
import { useOnline } from './hooks/useOnline'
import { useTheme } from './hooks/useTheme'
import { useUserData } from './hooks/useUserData'
import { DPDC_HOME_URL } from './lib/dpdc'
import { isFirebaseConfigured } from './lib/firebase'
import { useI18n } from './lib/i18n'
import { deleteCloud } from './lib/storage'

const BANNER_KEY = 'dpdc-bill-check:sync-banner-dismissed'

const TABS = ['check', 'history', 'gold'] as const
type Tab = (typeof TABS)[number]
/** The open tab lives in the URL hash, so reloads and shared links keep it; #check is also the skip-link target. */
const tabFromHash = (): Tab => {
  const hash = window.location.hash.slice(1)
  return (TABS as readonly string[]).includes(hash) ? (hash as Tab) : 'check'
}

export default function App() {
  const { t } = useI18n()
  const toast = useToast()
  const online = useOnline()
  const { theme, resolved, cycle } = useTheme()
  const auth = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function selectTab(next: Tab) {
    setTab(next)
    window.history.replaceState(null, '', `#${next}`)
  }
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) === '1'
    } catch {
      return false
    }
  })

  const { data, ready, update } = useUserData(auth.state, {
    onImported: (count) => toast(t('imported', { count })),
    onSyncError: () => toast(t('syncError'), { tone: 'error' }),
  })

  // Close the sign-in dialog and confirm once sign-in completes.
  const prevStatus = useRef(auth.state.status)
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = auth.state.status
    if (prev === 'signedOut' && auth.state.status === 'signedIn') {
      setAuthOpen(false)
      toast(t('signedIn'))
    }
  }, [auth.state.status, t, toast])

  async function signOut() {
    await auth.signOut().catch(() => {})
    toast(t('signedOut'))
  }

  async function deleteData() {
    if (auth.state.status !== 'signedIn') return
    if (!window.confirm(t('deleteCloudConfirm'))) return
    try {
      await deleteCloud(auth.state.user.uid)
      // Sign out right away so nothing writes the data back.
      await auth.signOut().catch(() => {})
      toast(t('cloudDeleted'))
    } catch {
      toast(t('ae_generic'), { tone: 'error' })
    }
  }

  const showBanner =
    isFirebaseConfigured && auth.state.status === 'signedOut' && data.accounts.length > 0 && !bannerDismissed

  return (
    <>
      <a
        href="#check"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skip')}
      </a>
      <Header
        auth={auth.state}
        theme={theme}
        onCycleTheme={cycle}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={signOut}
        onDeleteData={deleteData}
      />

      {!online && (
        <div className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm font-medium text-warning" role="status">
          <WifiOff className="size-4" /> {t('offline')}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:pt-8">
        {/* The page's main heading stays for screen readers and search engines, hidden from view. */}
        <h1 className="sr-only">{t('tagline')}</h1>

        <Tabs value={tab} onValueChange={(v) => selectTab(v as Tab)}>
          <div className="pointer-events-none sticky top-14 z-30 py-2">
            <TabsList aria-label={t('tabsLabel')} className="pointer-events-auto mx-auto flex max-w-md border shadow-sm">
              <TabsTrigger value="check">
                <Zap /> {t('tabCheck')}
              </TabsTrigger>
              <TabsTrigger value="history">
                <ChartColumn /> {t('tabBills')}
              </TabsTrigger>
              <TabsTrigger value="gold">
                <Coins /> {t('tabGold')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="check">
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <div className="grid grid-cols-1 gap-5">
                {ready ? (
                  <CheckBillCard key={auth.state.user?.uid ?? 'guest'} data={data} update={update} />
                ) : (
                  <Skeleton className="h-[420px] rounded-xl" aria-busy="true" />
                )}
                <p className="-mt-1 flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{t('whyCaptcha')}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {showBanner && (
                  <Alert variant="info" className="relative pr-10">
                    <Cloud />
                    <AlertTitle>{t('syncBannerTitle')}</AlertTitle>
                    <AlertDescription>
                      <p>{t('syncBannerBody')}</p>
                      <Button size="sm" className="mt-2 w-fit" onClick={() => setAuthOpen(true)}>
                        {t('signIn')}
                      </Button>
                    </AlertDescription>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-2 right-2"
                      aria-label={t('close')}
                      onClick={() => {
                        setBannerDismissed(true)
                        try {
                          localStorage.setItem(BANNER_KEY, '1')
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      <X />
                    </Button>
                  </Alert>
                )}
                {ready && (
                  <>
                    <AccountsCard data={data} update={update} />
                    <HistoryCard data={data} update={update} />
                  </>
                )}
                <ReminderCard />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {ready ? <BillHistoryCard data={data} update={update} /> : <Skeleton className="h-[420px] rounded-xl" aria-busy="true" />}
          </TabsContent>

          <TabsContent value="gold">
            <div className="mx-auto max-w-2xl">
              <GoldCard />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t">
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-1.5 px-4 py-6 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-1.5">
            {auth.state.status === 'signedIn' ? <Cloud className="size-3.5" /> : <Smartphone className="size-3.5" />}
            {auth.state.status === 'signedIn'
              ? t('syncedAs', { name: auth.state.user.displayName || auth.state.user.email || '' })
              : auth.state.status === 'unavailable'
                ? t('authUnavailable')
                : t('deviceOnly')}
          </p>
          <p>{t('footerDisclaimer')}</p>
          <p>
            <a
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              href={DPDC_HOME_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('officialSite')} <ExternalLink className="size-3.5" />
            </a>
          </p>
        </div>
      </footer>

      {isFirebaseConfigured && <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} auth={auth} />}
      <Toaster theme={resolved} position="bottom-center" richColors closeButton />
    </>
  )
}
