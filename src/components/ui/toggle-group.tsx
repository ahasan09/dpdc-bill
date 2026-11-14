import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Segmented control: a muted track with the selected item raised. */
function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1', className)}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
