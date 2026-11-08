import { useEffect, useRef, useState } from 'react'
import { AccountsCard } from './components/AccountsCard'
import { AuthDialog } from './components/AuthDialog'
import { BillHistoryCard } from './components/BillHistoryCard'
import { CheckBillCard } from './components/CheckBillCard'
import { Header } from './components/Header'
import { GoldCard } from './components/GoldCard'
import { HistoryCard } from './components/HistoryCard'
import { Icon } from './components/Icon'
import { ReminderCard } from './components/ReminderCard'
import { useToast } from './components/Toast'
import { useAuth } from './hooks/useAuth'
import { useOnline } from './hooks/useOnline'
import { useTheme } from './hooks/useTheme'
import { useUserData } from './hooks/useUserData'
import { DPDC_HOME_URL } from './lib/dpdc'
import { isFirebaseConfigured } from './lib/firebase'
import { useI18n } from './lib/i18n'
import { deleteCloud } from './lib/storage'

const BANNER_KEY = 'dpdc-bill-check:sync-banner-dismissed'

export default function App() {
  const { t } = useI18n()
  const toast = useToast()
  const online = useOnline()
  const { theme, cycle } = useTheme()
  const auth = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
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
      <a className="skip-link" href="#check">
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
        <div className="offline" role="status">
          <Icon name="wifiOff" size={16} /> {t('offline')}
        </div>
      )}

      <main className="main">
        {/* The page's main heading stays for screen readers and search engines, hidden from view. */}
        <h1 className="sr-only">{t('tagline')}</h1>

        <div className="grid">
          <div className="grid__main">
            {ready ? (
              <CheckBillCard key={auth.state.user?.uid ?? 'guest'} data={data} update={update} />
            ) : (
              <div className="card card--primary skeleton" aria-busy="true" />
            )}
            <p className="privacy">
              <Icon name="shield" size={16} />
              <span>{t('whyCaptcha')}</span>
            </p>
            <GoldCard />
          </div>

          <div className="grid__side">
            {showBanner && (
              <section className="banner">
                <Icon name="cloud" className="banner__icon" />
                <div>
                  <p className="banner__title">{t('syncBannerTitle')}</p>
                  <p>{t('syncBannerBody')}</p>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => setAuthOpen(true)}>
                    {t('signIn')}
                  </button>
                </div>
                <button
                  type="button"
                  className="icon-btn banner__close"
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
                  <Icon name="x" size={16} />
                </button>
              </section>
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

        {ready && (
          <div className="section">
            <BillHistoryCard data={data} update={update} />
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          <Icon name={auth.state.status === 'signedIn' ? 'cloud' : 'device'} size={14} />{' '}
          {auth.state.status === 'signedIn'
            ? t('syncedAs', { name: auth.state.user.displayName || auth.state.user.email || '' })
            : auth.state.status === 'unavailable'
              ? t('authUnavailable')
              : t('deviceOnly')}
        </p>
        <p>{t('footerDisclaimer')}</p>
        <p>
          <a className="link" href={DPDC_HOME_URL} target="_blank" rel="noopener noreferrer">
            {t('officialSite')} <Icon name="external" size={14} />
          </a>
        </p>
      </footer>

      {isFirebaseConfigured && <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} auth={auth} />}
    </>
  )
}
