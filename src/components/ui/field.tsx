import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** A label, control and message stacked with consistent spacing. */
function Field({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('grid gap-1.5', className)} {...props} />
}

/** Help or error text under a control. */
function FieldMessage({ className, tone = 'hint', ...props }: ComponentProps<'p'> & { tone?: 'hint' | 'error' | 'warn' }) {
  return (
    <p
      data-slot="field-message"
      className={cn(
        'text-xs leading-snug',
        tone === 'hint' && 'text-muted-foreground',
        tone === 'error' && 'font-medium text-destructive',
        tone === 'warn' && 'text-warning',
        className,
      )}
      {...props}
    />
  )
}

export { Field, FieldMessage }
