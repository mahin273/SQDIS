import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  variant?: 'neural' | 'solid' | 'glyph'
  className?: string
}

const sizeMap = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 44,
  xl: 56,
}

export function LogoIcon({
  size = 'md',
  variant = 'neural',
  className,
  ...props
}: LogoIconProps) {
  const dimension = typeof size === 'number' ? size : sizeMap[size] || 36

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none transition-transform', className)}
      {...props}
    >
      <defs>
        <linearGradient id="sqdis-n2-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient id="sqdis-n2-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Neural Glow */}
      <circle cx="32" cy="31" r="28" fill="url(#sqdis-n2-aura)" />

      {/* Outer Hexagonal Data Boundary */}
      <polygon
        points="32,8 52,19.5 52,42.5 32,54 12,42.5 12,19.5"
        stroke="url(#sqdis-n2-rim)"
        strokeWidth="2"
        strokeDasharray="4 3"
        opacity="0.75"
      />

      {/* Internal Weighted Tensor Vectors */}
      <line x1="32" y1="8" x2="32" y2="31" stroke="#a855f7" strokeWidth="2" />
      <line x1="52" y1="19.5" x2="32" y2="31" stroke="#6366f1" strokeWidth="2" />
      <line x1="52" y1="42.5" x2="32" y2="31" stroke="#38bdf8" strokeWidth="2" />
      <line x1="32" y1="54" x2="32" y2="31" stroke="#06b6d4" strokeWidth="2" />
      <line x1="12" y1="42.5" x2="32" y2="31" stroke="#8b5cf6" strokeWidth="2" />
      <line x1="12" y1="19.5" x2="32" y2="31" stroke="#ec4899" strokeWidth="2" />

      {/* Inner Dynamic Diamond Facets (AST Logic Cells) */}
      <polygon points="32,16 44,24 32,32 20,24" fill="#6366f1" opacity="0.65" />
      <polygon points="20,24 32,32 32,46 20,38" fill="#4338ca" opacity="0.85" />
      <polygon points="44,24 32,32 32,46 44,38" fill="#06b6d4" opacity="0.75" />

      {/* Peripheral Input Synapses */}
      <circle cx="32" cy="8" r="3.5" fill="#ec4899" />
      <circle cx="52" cy="19.5" r="3" fill="#a855f7" />
      <circle cx="52" cy="42.5" r="3" fill="#38bdf8" />
      <circle cx="32" cy="54" r="3.5" fill="#06b6d4" />
      <circle cx="12" cy="42.5" r="3" fill="#8b5cf6" />
      <circle cx="12" cy="19.5" r="3" fill="#ec4899" />

      {/* Central Quality Focal Core (The Verified Star) */}
      <circle cx="32" cy="31" r="5" fill="#ffffff" />
      <circle cx="32" cy="31" r="2.5" fill="#38bdf8" />
    </svg>
  )
}

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'neural' | 'solid' | 'glyph'
  showSubtitle?: boolean
  inverted?: boolean
  className?: string
}

export function Logo({
  size = 'md',
  variant = 'neural',
  showSubtitle = true,
  inverted = false,
  className,
}: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36
  const isWhiteText = inverted || variant === 'solid'

  const titleClass =
    size === 'sm'
      ? 'text-sm font-bold tracking-tight'
      : size === 'lg'
        ? 'text-xl font-extrabold tracking-tight'
        : 'text-base font-bold tracking-tight'
  const subClass =
    size === 'sm'
      ? 'text-[8px] font-semibold tracking-wider'
      : size === 'lg'
        ? 'text-[11px] font-semibold tracking-wider'
        : 'text-[9px] font-semibold tracking-wider'

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <LogoIcon size={iconSize} variant={variant} />
      <div className="flex flex-col min-w-0 leading-tight">
        <span
          className={cn(
            'font-sans',
            isWhiteText ? 'text-white' : 'text-foreground',
            titleClass
          )}
        >
          SQDIS
        </span>
        {showSubtitle && (
          <span
            className={cn(
              'uppercase font-medium truncate',
              isWhiteText ? 'text-slate-300' : 'text-muted-foreground',
              subClass
            )}
          >
            Quality Intelligence
          </span>
        )}
      </div>
    </div>
  )
}
