import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center">{action}</div>}
    </div>
  )
}

export function MetricTile({
  label,
  value,
  helper,
  icon,
}: {
  label: string
  value: ReactNode
  helper?: string
  icon?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
        {icon && <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-300">{icon}</div>}
      </CardContent>
    </Card>
  )
}

export function QueryState({
  isLoading,
  error,
  onRetry,
  children,
}: {
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <div>
            <p className="font-semibold text-slate-950 dark:text-white">Unable to load data</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {error instanceof Error ? error.message : 'Please try again.'}
            </p>
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}

export function formatScore(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A'
  return Math.round(value).toString()
}
