import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[color:var(--color-surface-2)]',
        className
      )}
      {...props}
    />
  )
}
