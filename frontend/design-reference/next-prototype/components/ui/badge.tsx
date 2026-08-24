import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-[color:var(--color-success-bg)] text-success',
  warning: 'bg-[color:var(--color-warning-bg)] text-warning',
  danger:  'bg-[color:var(--color-danger-bg)]  text-danger',
  info:    'bg-[color:var(--color-info-bg)]    text-info',
  ai:      'bg-[color:var(--color-ai-bg)]      text-ai',
  neutral: 'bg-surface-2 text-ink-soft border border-[color:var(--color-line)]',
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-[2px] rounded-[var(--radius-pill)] text-[11px] font-medium leading-relaxed',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}
