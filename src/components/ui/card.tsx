import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn('flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5 shadow-sm', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex min-h-8 items-center justify-between gap-3', className)} {...props} />
}

function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('flex items-center gap-2 text-base leading-tight font-semibold', className)} {...props} />
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Card, CardDescription, CardHeader, CardTitle }
