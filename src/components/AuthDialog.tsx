import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { AuthError, type AuthApi } from '../hooks/useAuth'
import { isValidEmail } from '../lib/dpdc'
import { useI18n } from '../lib/i18n'
import { Dialog } from './Dialog'
import { GoogleLogo } from './Icon'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Field, FieldMessage } from './ui/field'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'

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
      <div className="grid gap-4">
        {mode !== 'reset' && (
          <>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={busy !== null}
              onClick={() => attempt('google', auth.signInWithGoogle)}
            >
              {busy === 'google' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <GoogleLogo />}
              {t('continueGoogle')}
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
              <Separator className="flex-1" />
              <span>{t('or')}</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}

        <form className="grid gap-4" onSubmit={submit} noValidate>
          {mode === 'signUp' && (
            <Field>
              <Label htmlFor={ids.name}>{t('name')}</Label>
              <Input id={ids.name} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field>
            <Label htmlFor={ids.email}>{t('email')}</Label>
            <Input
              id={ids.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== 'reset' && (
            <Field>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={ids.password}>{t('password')}</Label>
                {mode === 'signIn' && (
                  <Button type="button" variant="link" size="xs" onClick={() => switchMode('reset')}>
                    {t('forgotPassword')}
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  id={ids.password}
                  type={showPassword ? 'text' : 'password'}
                  className="pr-10"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  aria-describedby={mode === 'signUp' ? `${ids.password}-hint` : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-0.5 right-0.5 text-muted-foreground"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {mode === 'signUp' && <FieldMessage id={`${ids.password}-hint`}>{t('passwordHint')}</FieldMessage>}
            </Field>
          )}

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert variant="success" role="status">
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
            {busy === 'email' && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {mode === 'reset' ? t('sendReset') : mode === 'signUp' ? t('createAccountButton') : t('signInButton')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signIn' && (
            <>
              {t('noAccount')}{' '}
              <Button type="button" variant="link" onClick={() => switchMode('signUp')}>
                {t('createAccount')}
              </Button>
            </>
          )}
          {mode === 'signUp' && (
            <>
              {t('haveAccount')}{' '}
              <Button type="button" variant="link" onClick={() => switchMode('signIn')}>
                {t('signInButton')}
              </Button>
            </>
          )}
          {mode === 'reset' && (
            <Button type="button" variant="link" onClick={() => switchMode('signIn')}>
              {t('backToSignIn')}
            </Button>
          )}
        </p>
      </div>
    </Dialog>
  )
}
