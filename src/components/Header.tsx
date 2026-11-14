import { Cloud, LogOut, Monitor, Moon, Sun, Trash2, User, Zap } from 'lucide-react'
import type { AuthState } from '../hooks/useAuth'
import type { ThemeChoice } from '../hooks/useTheme'
import { useI18n } from '../lib/i18n'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Skeleton } from './ui/skeleton'

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

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel = theme === 'light' ? t('themeLight') : theme === 'dark' ? t('themeDark') : t('themeSystem')
  const user = auth.status === 'signedIn' ? auth.user : null
  const initials = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#check" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span
            className="grid size-8 place-items-center rounded-lg bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"
            aria-hidden="true"
          >
            <Zap className="size-[18px] fill-current" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold">{t('appName')}</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">{t('unofficial')}</span>
          </span>
        </a>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            lang={lang === 'en' ? 'bn' : 'en'}
            aria-label={t('languageLabel')}
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          >
            {t('language')}
          </Button>
          <Button variant="ghost" size="icon" onClick={onCycleTheme} aria-label={themeLabel} title={themeLabel}>
            <ThemeIcon />
          </Button>

          {auth.status === 'signedOut' && (
            <Button size="sm" className="ml-1" onClick={onSignIn}>
              <User /> {t('signIn')}
            </Button>
          )}
          {auth.status === 'loading' && <Skeleton className="ml-1 size-8 rounded-full" aria-hidden="true" />}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('accountMenu')}
                  className="ml-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Avatar>
                    {user.photoURL && <AvatarImage src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
                  <Cloud className="size-4 shrink-0" />
                  <span className="truncate">{t('syncedAs', { name: user.displayName || user.email || '' })}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onSignOut}>
                  <LogOut /> {t('signOut')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDeleteData}>
                  <Trash2 /> {t('deleteCloudData')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
