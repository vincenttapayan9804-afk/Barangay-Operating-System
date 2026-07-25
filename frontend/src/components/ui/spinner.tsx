import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const spinnerVariants = cva('animate-spin rounded-full border-2 border-current border-t-transparent', {
  variants: {
    size: {
      sm: 'size-3',
      md: 'size-5',
      lg: 'size-8',
    },
  },
  defaultVariants: { size: 'md' },
})

export interface SpinnerProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size, label, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
      <div className={spinnerVariants({ size })} role="status" aria-label={label ?? 'Loading'} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  ),
)
Spinner.displayName = 'Spinner'

export { Spinner, spinnerVariants }
