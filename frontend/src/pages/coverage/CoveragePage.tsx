import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { coverageService } from '@/services'
import { queryKeys } from '@/lib/queryClient'
import { formatBytes, formatDate, formatNumber } from '@/lib/utils'
import { MetricTile, PageHeader, QueryState, formatScore } from '../pageUtils'

export function CoveragePage() {
  const coverageQuery = useQuery({
    queryKey: queryKeys.coverage.all({ page: 1, limit: 50 }),
    queryFn: () => coverageService.getAll({ page: 1, limit: 50 }),
  })

  const rawCoverage = coverageQuery.data
  const reports = Array.isArray(rawCoverage) ? rawCoverage : (rawCoverage?.reports ?? [])
  const completed = reports.filter((report) => report.status === 'COMPLETED')
  const averageCoverage =
    completed.length > 0
      ? completed.reduce((sum, report) => sum + (report.coveragePercentage ?? 0), 0) / completed.length
      : 0

  return (
    <div>
      <PageHeader
        title="Coverage"
        description="Inspect uploaded coverage reports and repository coverage movement."
        action={<Button leftIcon={<Upload className="h-4 w-4" />}>Upload report</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricTile label="Reports" value={formatNumber(coverageQuery.data?.total ?? reports.length)} icon={<ShieldCheck className="h-5 w-5" />} />
        <MetricTile label="Completed" value={completed.length} />
        <MetricTile label="Average coverage" value={`${formatScore(averageCoverage)}%`} />
      </div>

      <QueryState isLoading={coverageQuery.isLoading} error={coverageQuery.error} onRetry={() => coverageQuery.refetch()}>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                title="No coverage reports found"
                description="No test coverage reports have been uploaded yet. Upload an LCOV, Cobertura, or JaCoCo report to track repository test coverage."
                icon={<ShieldCheck className="h-7 w-7 text-indigo-500" />}
                action={<Button leftIcon={<Upload className="h-4 w-4" />}>Upload report</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_12rem_8rem] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-slate-950 dark:text-white">
                        {report.repository?.name ?? report.originalFilename}
                      </h2>
                      <Badge variant={report.status === 'COMPLETED' ? 'success' : report.status === 'FAILED' ? 'danger' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {report.format} · {formatBytes(report.fileSize)} · {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <Progress value={report.coveragePercentage ?? 0} showValue label="Line coverage" />
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">
                    {formatNumber(report.linesCovered ?? 0)} / {formatNumber(report.linesTotal ?? 0)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  )
}
