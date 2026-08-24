import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-body font-medium cursor-pointer border-none transition-all disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap'
    const sizes = { sm: 'h-[30px] px-3 text-xs', md: 'h-9 px-[14px] text-sm' }
    const variants = {
      primary:   'bg-brand text-white shadow-card hover:opacity-90',
      secondary: 'bg-transparent text-ink-soft border border-[color:var(--color-line-strong)] hover:bg-surface',
      ghost:     'bg-transparent text-ink-soft hover:bg-[color:var(--color-surface-2)]',
      danger:    'bg-transparent text-danger hover:bg-[color:var(--color-danger-bg)]',
    }
    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], variants[variant], 'rounded-[var(--radius-md)]', className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
