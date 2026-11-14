import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import { cn } from '@/lib/utils'
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, Dialog as UiDialog } from './ui/dialog'

/** App dialog: shadcn/Radix dialog (focus trap, Escape, scroll lock) with a title and optional subtitle. */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  wide,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Wider dialog for forms with several columns. */
  wide?: boolean
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <UiDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        closeLabel={t('close')}
        className={cn(wide && 'max-w-3xl')}
        // Without a subtitle there is no description; say so explicitly so Radix doesn't warn.
        {...(!subtitle && { 'aria-describedby': undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </UiDialog>
  )
}
