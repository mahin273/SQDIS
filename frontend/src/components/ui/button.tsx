import React from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './spinner'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'link'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  asChild?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-slate-900 text-white hover:bg-slate-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 focus-visible:ring-ring shadow-sm',
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring shadow-sm',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring',
  outline:
    'border border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground focus-visible:ring-ring',
  ghost:
    'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
  danger:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring shadow-sm',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring shadow-sm',
  link: 'text-primary underline-offset-4 hover:underline p-0 h-auto bg-transparent',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-lg gap-2.5',
  icon: 'h-10 w-10 p-0 rounded-lg justify-center',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      asChild,
      children,
      ...props
    },
    ref
  ) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
        className: cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className
        ),
      })
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === 'sm' ? 'sm' : 'md'} className="text-current shrink-0" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
