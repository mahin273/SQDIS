import type { ReactNode } from 'react'

type RangeOption = {
  label: string
  value: number
}

type Props = {
  title: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  rangeOptions?: RangeOption[]
  selectedRange?: number
  onRangeChange?: (days: number) => void
}

export default function MetricChart({
  title,
  icon,
  children,
  footer,
  rangeOptions,
  selectedRange,
  onRangeChange,
}: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <div className="text-lg text-gray-500" aria-hidden="true">
              {icon}
            </div>
          ) : null}
          <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
        </div>

        {rangeOptions && rangeOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            {rangeOptions.map((opt) => {
              const active = opt.value === selectedRange
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ' +
                    (active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50')
                  }
                  onClick={() => onRangeChange?.(opt.value)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="px-2 py-3">
        <div className="h-72 w-full">{children}</div>
      </div>

      {footer ? <div className="border-t border-gray-200">{footer}</div> : null}
    </section>
  )
}
