import type { ReactNode } from 'react'
import { FiArrowDownRight, FiArrowRight, FiArrowUpRight } from 'react-icons/fi'

type TrendDirection = 'up' | 'down' | 'flat'

type Props = {
  title: string
  value: string
  icon?: ReactNode
  trend?: {
    direction: TrendDirection
    label: string
  }
  secondary?: string
  highlight?: 'none' | 'sqs'
}

function getTrendIcon(direction: TrendDirection) {
  if (direction === 'up') return <FiArrowUpRight />
  if (direction === 'down') return <FiArrowDownRight />
  return <FiArrowRight />
}

function getSqsTone(value: string) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'text-gray-900'
  if (num > 70) return 'text-green-700'
  if (num >= 50) return 'text-yellow-700'
  return 'text-red-700'
}

export default function MetricCard({
  title,
  value,
  icon,
  trend,
  secondary,
  highlight = 'none',
}: Props) {
  const valueClass =
    highlight === 'sqs' ? getSqsTone(value) : 'text-gray-900 dark:text-slate-100'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-700 dark:text-slate-300">{title}</div>
        {icon ? (
          <div className="text-lg text-gray-500 dark:text-slate-400" aria-hidden="true">
            {icon}
          </div>
        ) : null}
      </div>

      <div className={"mt-2 text-2xl font-semibold tracking-tight " + valueClass}>
        {value}
      </div>

      {trend ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
          <span className="text-gray-500 dark:text-slate-500" aria-hidden="true">
            {getTrendIcon(trend.direction)}
          </span>
          <span>{trend.label}</span>
        </div>
      ) : null}

      {secondary ? (
        <div className="mt-2 text-sm font-medium text-gray-700 dark:text-slate-300">{secondary}</div>
      ) : null}

    </div>
  )
}
