import { useEffect, useRef, useState } from 'react'
import type { AuthState } from '../hooks/useAuth'
import type { ThemeChoice } from '../hooks/useTheme'
import { useI18n } from '../lib/i18n'
import { Icon } from './Icon'

export function Header({
  auth,
  theme,
  onCycleTheme,
  onSignIn,
  onSignOut,
  onDeleteData,
}: {
  auth: AuthState
  theme: ThemeChoice
  onCycleTheme: () => void
  onSignIn: () => void
  onSignOut: () => void
  onDeleteData: () => void
}) {
  const { t, lang, setLang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const themeIcon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor'
  const themeLabel = theme === 'light' ? t('themeLight') : theme === 'dark' ? t('themeDark') : t('themeSystem')
  const user = auth.status === 'signedIn' ? auth.user : null
  const initials = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="header">
      <div className="header__inner">
        <a className="brand" href="#check">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="bolt" size={20} />
          </span>
          <span>
            <span className="brand__name">{t('appName')}</span>
            <span className="brand__sub">{t('unofficial')}</span>
          </span>
        </a>

        <div className="header__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm lang-btn"
            lang={lang === 'en' ? 'bn' : 'en'}
            aria-label={t('languageLabel')}
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          >
            {t('language')}
          </button>
          <button type="button" className="icon-btn" onClick={onCycleTheme} aria-label={themeLabel} title={themeLabel}>
            <Icon name={themeIcon} />
          </button>

          {auth.status === 'signedOut' && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onSignIn}>
              <Icon name="user" size={16} /> {t('signIn')}
            </button>
          )}
          {auth.status === 'loading' && <span className="avatar avatar--loading" aria-hidden="true" />}
          {user && (
            <div className="menu" ref={menuRef}>
              <button
                type="button"
                className="avatar"
                aria-label={t('accountMenu')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : initials}
              </button>
              {menuOpen && (
                <div className="menu__panel" role="menu">
                  <div className="menu__who">
                    <Icon name="cloud" size={16} />
                    <span>{t('syncedAs', { name: user.displayName || user.email || '' })}</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item"
                    onClick={() => {
                      setMenuOpen(false)
                      onSignOut()
                    }}
                  >
                    <Icon name="logout" size={16} /> {t('signOut')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item menu__item--danger"
                    onClick={() => {
                      setMenuOpen(false)
                      onDeleteData()
                    }}
                  >
                    <Icon name="trash" size={16} /> {t('deleteCloudData')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
