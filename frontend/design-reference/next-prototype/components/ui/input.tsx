import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 px-3 w-full bg-[color:var(--color-field)] border border-[color:var(--color-field-line)]',
        'rounded-[var(--radius-md)] font-body text-sm text-ink outline-none transition-all',
        'placeholder:text-[color:var(--color-ink-faint)]',
        'focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-subtle)]',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
