import { useId, useState, type FormEvent } from 'react'
import { AuthError, type AuthApi } from '../hooks/useAuth'
import { isValidEmail } from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import { Dialog } from './Dialog'
import { GoogleLogo, Icon } from './Icon'

type Mode = 'signIn' | 'signUp' | 'reset'

export function AuthDialog({ open, onClose, auth }: { open: boolean; onClose: () => void; auth: AuthApi }) {
  const { t } = useI18n()
  const ids = { email: useId(), password: useId(), name: useId() }
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState<'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function attempt(kind: 'google' | 'email', fn: () => Promise<unknown>) {
    setBusy(kind)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(t(e instanceof AuthError ? e.messageKey : 'ae_generic'))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) return setError(t('ae_email'))
    if (mode === 'reset') {
      if (await attempt('email', () => auth.resetPassword(email))) setInfo(t('resetSent'))
      return
    }
    if (password.length < 6) return setError(t('ae_weak'))
    await attempt('email', () =>
      mode === 'signIn' ? auth.signInWithEmail(email, password) : auth.signUpWithEmail(email, password, name),
    )
  }

  const title = mode === 'reset' ? t('resetTitle') : mode === 'signUp' ? t('createAccount') : t('authTitle')

  return (
    <Dialog open={open} onClose={onClose} title={title} subtitle={mode === 'reset' ? undefined : t('authSubtitle')}>
      <div className="stack">
        {mode !== 'reset' && (
          <>
            <button
              type="button"
              className="btn btn--outline btn--lg btn--block"
              disabled={busy !== null}
              onClick={() => attempt('google', auth.signInWithGoogle)}
            >
              {busy === 'google' ? <span className="spinner" aria-hidden="true" /> : <GoogleLogo />}
              {t('continueGoogle')}
            </button>
            <div className="divider">
              <span>{t('or')}</span>
            </div>
          </>
        )}

        <form className="stack" onSubmit={submit} noValidate>
          {mode === 'signUp' && (
            <div className="field">
              <label htmlFor={ids.name} className="label">
                {t('name')}
              </label>
              <input id={ids.name} className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor={ids.email} className="label">
              {t('email')}
            </label>
            <input
              id={ids.email}
              type="email"
              className="input"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== 'reset' && (
            <div className="field">
              <div className="label-row">
                <label htmlFor={ids.password} className="label">
                  {t('password')}
                </label>
                {mode === 'signIn' && (
                  <button type="button" className="link link--sm" onClick={() => switchMode('reset')}>
                    {t('forgotPassword')}
                  </button>
                )}
              </div>
              <div className="input-wrap">
                <input
                  id={ids.password}
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  aria-describedby={mode === 'signUp' ? `${ids.password}-hint` : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-wrap__btn icon-btn"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
              {mode === 'signUp' && (
                <p id={`${ids.password}-hint`} className="hint">
                  {t('passwordHint')}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="alert alert--ok" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy !== null}>
            {busy === 'email' && <span className="spinner" aria-hidden="true" />}
            {mode === 'reset' ? t('sendReset') : mode === 'signUp' ? t('createAccountButton') : t('signInButton')}
          </button>
        </form>

        <p className="center muted">
          {mode === 'signIn' && (
            <>
              {t('noAccount')}{' '}
              <button type="button" className="link" onClick={() => switchMode('signUp')}>
                {t('createAccount')}
              </button>
            </>
          )}
          {mode === 'signUp' && (
            <>
              {t('haveAccount')}{' '}
              <button type="button" className="link" onClick={() => switchMode('signIn')}>
                {t('signInButton')}
              </button>
            </>
          )}
          {mode === 'reset' && (
            <button type="button" className="link" onClick={() => switchMode('signIn')}>
              {t('backToSignIn')}
            </button>
          )}
        </p>
      </div>
    </Dialog>
  )
}
