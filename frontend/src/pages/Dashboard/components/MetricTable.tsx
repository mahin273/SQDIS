import type { ReactNode } from 'react'

type Props = {
  title: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}

export default function MetricTable({
  title,
  icon,
  actionLabel = 'View All →',
  onAction,
  children,
}: Props) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <div className="text-lg text-gray-500 dark:text-slate-400" aria-hidden="true">
              {icon}
            </div>
          ) : null}
          <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        </div>

        {onAction ? (
          <button
            type="button"
            className="text-sm font-semibold text-gray-900 hover:underline dark:text-slate-100"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className="px-5 py-4">{children}</div>
    </section>
  )
}
