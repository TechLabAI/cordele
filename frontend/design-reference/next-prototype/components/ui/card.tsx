import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hero?: boolean
  interactive?: boolean
}

export function Card({ className, hero, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-card p-5',
        hero && 'glass--hero',
        interactive && 'cursor-pointer transition-transform hover:-translate-y-px',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-[15px] font-semibold text-ink', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />
}
