import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  variant?: 'obsidian' | 'solid' | 'glyph'
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
  variant = 'obsidian',
  className,
  ...props
}: LogoIconProps) {
  const dimension = typeof size === 'number' ? size : sizeMap[size] || 36

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      {...props}
    >
      <defs>
        <linearGradient id="sqdis-obsidian-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
        <linearGradient id="sqdis-obsidian-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="sqdis-solid-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="sqdis-glyph-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      {variant === 'obsidian' && (
        <rect
          x="2.5"
          y="2.5"
          width="43"
          height="43"
          rx="12"
          fill="url(#sqdis-obsidian-bg)"
          stroke="url(#sqdis-obsidian-border)"
          strokeWidth="1.5"
        />
      )}

      {variant === 'solid' && (
        <rect
          x="2.5"
          y="2.5"
          width="43"
          height="43"
          rx="12"
          fill="url(#sqdis-solid-bg)"
        />
      )}

      {/* S & Q Telemetry Ribbon */}
      <path
        d="M 31 14.5 C 31 12 28.5 10.5 24 10.5 C 18 10.5 14.5 13.5 14.5 17.5 C 14.5 22 18.5 23.5 24 24.5 C 29.5 25.5 33.5 27 33.5 31.5 C 33.5 36 29.5 37.5 24 37.5 C 18 37.5 14.5 34.5 14.5 31"
        stroke={variant === 'solid' ? '#ffffff' : 'url(#sqdis-glyph-stroke)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Q Diagnostic Vector */}
      <path
        d="M 26.5 27 L 35.5 36"
        stroke={variant === 'solid' ? '#a5f3fc' : '#06b6d4'}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Quality Core Telemetry Node */}
      <circle
        cx="24"
        cy="24"
        r="2"
        fill={variant === 'solid' ? '#a5f3fc' : '#38bdf8'}
      />
    </svg>
  )
}

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'obsidian' | 'solid' | 'glyph'
  showSubtitle?: boolean
  inverted?: boolean
  className?: string
}

export function Logo({
  size = 'md',
  variant = 'obsidian',
  showSubtitle = true,
  inverted = false,
  className,
}: LogoProps) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 42 : 36
  const isWhiteText = inverted || variant === 'solid'

  const titleClass =
    size === 'sm'
      ? 'text-sm font-bold'
      : size === 'lg'
        ? 'text-xl font-extrabold'
        : 'text-base font-bold'
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
            'tracking-tight font-sans',
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
